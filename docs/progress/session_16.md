# Session 16 — Devnet pipeline prep + program id alignment (Phase 3 step 7)

## Context

Continue from Session 15 next step: **devnet + AWS pipeline slice** (Phase 3 step 7). This session delivered **tooling, infrastructure prep, and program-id hygiene** so manual deploy and off-chain consumers share one canonical on-chain program id. The live **devnet → Ingestion → SNS → SQS → Aggregator → DynamoDB** run is still pending.

## Implementation Summary

### `tools/voting-shared/`

- Shared crypto/electorate/PDA helpers (ADR 0001, 0003) extracted from `eligibility-admin`.
- `verifyMerkleProof` for proof validation.
- Golden fixture tests (35 tests); PDA snapshots updated for synced program id.

### `tools/devnet-pipeline/`

- CLI: `bootstrap`, `lifecycle`, `write-voter-list` for devnet commit → reveal → finalize.
- Reuses `voting-shared`; chain helpers in `src/chain.ts`.
- Default `VOTING_PROGRAM_ID` aligned with `Anchor.toml`.

### `tools/eligibility-admin/`

- Refactored to depend on `voting-shared` (removed duplicate merkle/electorate/pda).
- Default program id updated to match canonical deploy keypair.

### AWS / packaging

- Terraform: Aggregator `provided.al2023`, EventBridge schedule for Ingestion Lambda.
- `services/aggregator/scripts/package-lambda.sh`
- `infra/aws/dev.tfvars.example` extended with devnet/Lambda paths and synced `solana_program_id`.

### Scripts and docs

- `docs/setup_devnet_pipeline.md` — full runbook (updated for keypair workflow).
- `smart-contract/scripts/deploy-devnet.sh` — `ensure-program-keypair`, `CARGO_TARGET_DIR`, `--program-keypair`.
- `smart-contract/scripts/ensure-program-keypair.sh` — copy `keys/` → `target/deploy/`.
- `scripts/invoke-ingestion-lambda.sh`, `scripts/verify-dynamodb-projection.sh`

### Program id alignment (standard Anchor workflow)

The placeholder vanity id `VotiNG111…` had no matching deploy keypair, causing `DeclaredProgramIdMismatch` on manual `anchor deploy` / `devnet-pipeline` CLI (while `anchor test` still passed via genesis `--bpf-program` loading).

- `anchor keys sync` → canonical id **`BbnG5ScQxQrvZVq5FiDEgH7zx8dK6qH9jN3DEUmJSiuc`**
- Committed `smart-contract/keys/voting-program-keypair.json` + `keys/README.md`
- Synced: `declare_id!`, `Anchor.toml` (localnet + devnet), ingestion IDL, Terraform example, tool defaults, PDA golden tests
- `smart-contract/README.md` — program id workflow documented
- `run-all-tests.sh` calls `ensure-program-keypair.sh` before `anchor test`

### Repo hygiene

- Root `.gitignore`: `**/test-ledger/`, `**/.anchor/`
- `smart-contract/.gitignore`: `docker-target/` (sandbox/Docker Cargo output)

## Files or Modules Added (key)

| Area | Paths |
|------|--------|
| Shared lib | `tools/voting-shared/` |
| Devnet CLI | `tools/devnet-pipeline/` |
| Program keypair | `smart-contract/keys/voting-program-keypair.json`, `scripts/ensure-program-keypair.sh` |
| Runbook | `docs/setup_devnet_pipeline.md` |
| Gitignore | `.gitignore`, `smart-contract/.gitignore` |

## Verification

```bash
cd tools/voting-shared && npm test                    # 35/35
cd smart-contract && ./scripts/ensure-program-keypair.sh && export CARGO_TARGET_DIR=$PWD/target && anchor test  # 46/46
cd tools/eligibility-admin && npm run typecheck
cd tools/devnet-pipeline && npm run typecheck
cd infra/aws && terraform fmt -check && terraform validate
```

**Not verified this session:** live devnet deploy, `devnet-pipeline lifecycle`, `terraform apply`, DynamoDB projection check (blocked: devnet wallet funding + AWS credentials on the dev machine).

## Architectural Notes

- **Program id** = pubkey of `keys/voting-program-keypair.json`; `declare_id!` and `[programs.*]` must stay in sync (`anchor keys sync` after keypair rotation).
- **Wallet** (`~/.config/solana/id.json`) pays deploy rent; **program keypair** determines on-chain program address — two different keys.
- Ingestion, Terraform, and CLI tools must use the same id as `Anchor.toml` / deployed program.
- `anchor test` embeds the program at the `Anchor.toml` address; manual deploy requires matching keypair + rebuilt `voting.so` (`CARGO_TARGET_DIR` pinned to `smart-contract/target`).

## Commits (this milestone)

1. `f4c0fcc` — devnet pipeline prep (voting-shared, devnet CLI, AWS wiring)
2. `bf3c74d` — sync voting program id with canonical deploy keypair
3. `a9fd628` — ignore Solana validator and Anchor build artifacts

## Not Done This Session

1. **Live devnet slice** — deploy program to devnet, run `lifecycle`, `terraform apply`, invoke Ingestion, verify DynamoDB.
2. Self-audit workshop (Phase 3 step 9).

## Next Steps

1. **Fund devnet wallet** — `solana config set --url devnet`; airdrop or faucet for `~/.config/solana/id.json`.
2. **Deploy program** — `cd smart-contract && ./scripts/deploy-devnet.sh` (expect id `BbnG5…`).
3. **Run chain lifecycle** — `cd tools/devnet-pipeline && npm run cli -- write-voter-list … && bootstrap && lifecycle` (save `proposal_id`).
4. **AWS half** — configure credentials; package Lambdas; `terraform apply -var-file=dev.tfvars`; `./scripts/invoke-ingestion-lambda.sh`; `./scripts/verify-dynamodb-projection.sh <proposal_id>`.
5. **Record E2E outcome** in `docs/progress/session_17.md` when the slice is green.
6. **Deferred:** dependency audit execution (`docs/planning/deferred_dependency_audit_and_ci.md`).

## References

- `docs/progress/session_15.md`
- `docs/setup_devnet_pipeline.md`
- `smart-contract/keys/README.md`
- `.cursor/rules/development_plan.mdc` Phase 3 step 7
