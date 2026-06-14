# Aggregator Service

Go service that consumes voting events from SQS and maintains the **operational projection** in DynamoDB.

## Responsibilities

- Consume canonical events from the aggregator SQS queue (via SNS fan-out)
- Process **`ProposalCreated`**, **`VoteCommitted`**, **`VoteRevealed`**, **`ProposalFinalized`**, and **`ProposalClosed`**
- Track voter participation (`has_committed`, `has_revealed` per proposal)
- Update proposal `option_counts` from **`VoteRevealed` only**; set `results_visible` on **`ProposalFinalized`**
- Idempotent handling via `processed_events` (at-least-once SQS delivery)

Eligibility audit events (`EligibleVotersRootUpdated`, grant/revoke) are **skipped** in this iteration (logged only).

## Layout

- `cmd/aggregator/` — entrypoint
- `internal/app/handlers/` — SQS Lambda handler
- `internal/app/service/` — projection orchestration
- `internal/app/domain/` — event parsing
- `internal/app/repository/` — DynamoDB and in-memory stores

## Tests

```bash
cd services/aggregator
go test ./...
```

## Lambda package (AWS deploy)

```bash
chmod +x scripts/package-lambda.sh
./scripts/package-lambda.sh
# → aggregator-lambda.zip (provided.al2023 / bootstrap)
```

See [`docs/setup_devnet_pipeline.md`](../../docs/setup_devnet_pipeline.md) for the devnet + AWS slice.

## Notes

- Legacy **`VoteCast`** has been removed from active code paths.
- Invalid payloads fail the SQS batch item so messages can retry or reach DLQ.
