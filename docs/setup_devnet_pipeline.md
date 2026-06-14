# Devnet + AWS pipeline slice (Phase 3 step 7)

Runbook for the vertical slice:

**Solana devnet** → **Ingestion Lambda** → **SNS** → **SQS** → **Aggregator Lambda** → **DynamoDB**

Prerequisites: local toolchain from [`setup_smart_contract.md`](setup_smart_contract.md), AWS CLI credentials with permission to deploy `infra/aws/`, and a funded Solana devnet wallet (`~/.config/solana/id.json`).

---

## 1. Build and deploy the program (devnet)

```bash
cd smart-contract
chmod +x scripts/deploy-devnet.sh
./scripts/deploy-devnet.sh
```

Record the program id (default in `Anchor.toml`: `VotiNG1111111111111111111111111111111111111`). If deploy prints a different id, set it in Terraform and env vars.

```bash
anchor build   # produces target/idl/voting.json for CLI tools
```

---

## 2. Prepare voter list

The voter must be in the Merkle electorate. For a single-wallet devnet slice, write your wallet pubkey:

```bash
cd tools/devnet-pipeline
npm install
npm run cli -- write-voter-list --write-voter-list /tmp/devnet-voters.txt
```

Or use the golden fixture (algorithm test keys, not your wallet):

`smart-contract/tests/fixtures/golden-0001-voter-list-input.txt`

---

## 3. Bootstrap registry on devnet

```bash
export SOLANA_RPC_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

npm run cli -- bootstrap --list /tmp/devnet-voters.txt
```

---

## 4. Run voting lifecycle on devnet

Runs **create_proposal → commit_vote → reveal_vote → finalize_proposal** with phase waits (~70s default).

```bash
npm run cli -- lifecycle --list /tmp/devnet-voters.txt --json
```

Save `proposal_id` from the output for verification.

To speed up phase windows (minimum practical: commit 15s, reveal 45s):

```bash
npm run cli -- lifecycle --list /tmp/devnet-voters.txt \
  --commit-seconds 15 --reveal-seconds 45
```

---

## 5. Package Lambda artifacts

**Ingestion:**

```bash
cd services/ingestion
npm install
npm run build
npm run package
# → ingestion-lambda.zip
```

**Aggregator:**

```bash
cd services/aggregator
chmod +x scripts/package-lambda.sh
./scripts/package-lambda.sh
# → aggregator-lambda.zip
```

---

## 6. Deploy AWS infrastructure

```bash
cd infra/aws
cp dev.tfvars.example dev.tfvars
# Edit zip paths, solana_rpc_url, solana_program_id if needed

terraform init
terraform fmt -check
terraform validate
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

Terraform creates:

- SNS topic + aggregator/forwarder SQS queues (+ DLQs)
- DynamoDB: `proposals`, `voter-activity`, `processed-events`
- Ingestion Lambda (polls devnet, publishes to SNS)
- Aggregator Lambda (SQS trigger → DynamoDB)
- EventBridge schedule (default: every 1 minute)

Disable the schedule and invoke manually:

```hcl
ingestion_schedule_enabled = false
```

---

## 7. Trigger ingestion

**Manual (recommended right after lifecycle):**

```bash
chmod +x scripts/invoke-ingestion-lambda.sh
./scripts/invoke-ingestion-lambda.sh
```

**Scheduled:** EventBridge invokes Ingestion every `ingestion_schedule_minutes` (default 1).

Re-invoke after each chain tx if you want faster feedback than the schedule.

---

## 8. Verify projection

**DynamoDB proposal item:**

```bash
chmod +x scripts/verify-dynamodb-projection.sh
./scripts/verify-dynamodb-projection.sh <proposal_id>
```

Expect after full lifecycle + ingestion + aggregator processing:

| Field | Expected |
|-------|----------|
| `phase` | `finalized` |
| `results_visible` | `true` |
| `option_counts` | e.g. `"1": 1` for option `1` |

**CloudWatch logs:**

- `/aws/lambda/voting-dev-ingestion` — published event count, RPC errors
- `/aws/lambda/voting-dev-aggregator` — processed events, projection errors

**SQS:**

- Aggregator queue depth should return to 0 after processing
- Check DLQ (`voting-dev-sqs-aggregator-dlq`) if messages stall

---

## 9. Troubleshooting

| Symptom | Check |
|---------|--------|
| Ingestion finds no events | `SOLANA_PROGRAM_ID` matches deploy; increase `ingestion_lookback_slots`; invoke Lambda manually after txs |
| Aggregator DLQ messages | CloudWatch aggregator logs; malformed JSON or missing DynamoDB table |
| `phase` stuck at `commit` | Lifecycle not finished; or Ingestion not yet polled finalize tx |
| Duplicate counts | Should not happen — Aggregator dedupes via `processed_events` |

---

## 10. Exit criteria (step 7)

- [ ] Devnet program deployed
- [ ] Lifecycle txs emit `ProposalCreated`, `VoteCommitted`, `VoteRevealed`, `ProposalFinalized`
- [ ] Ingestion publishes normalized events to SNS
- [ ] Aggregator updates DynamoDB with `results_visible: true` and correct `option_counts`
- [ ] Documented in `docs/progress/session_N.md`

---

## References

- Local pipeline tests (no AWS): `services/ingestion/src/blockchain/pipeline-e2e.test.ts`, `services/aggregator/internal/app/service/projection_e2e_test.go`
- Registry admin: `tools/eligibility-admin/`
- Terraform: `infra/aws/`
- `.cursor/rules/development_plan.mdc` Phase 3 step 7
