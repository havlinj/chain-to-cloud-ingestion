# Aggregator Service (Go)

AWS Lambda consumer that reads voting events from the Aggregator SQS queue (SNS fan-out), applies idempotent operational projections to DynamoDB, and exposes no synchronous APIs in iteration 1.

## Responsibilities (iteration 1)

- Unwrap SNS notification envelopes from SQS message bodies
- Process `VoteCast` events only (other event types are logged and skipped)
- Deduplicate by `event_id` via the `processed_events` DynamoDB table
- Update `proposals` (vote totals, per-option counts) and `voter_activity`

## Voting window (deadline / duration)

**Not configured in Aggregator.** How long voting stays open is enforced by the **smart contract** (`voting_ends_at` at create and/or `close_proposal`). Ingestion forwards events; this service projects them.

- Planned: `ProposalCreated` → store `status`, optional `voting_ends_at`; `ProposalClosed` → `status: closed`.
- Invalid votes should fail on-chain; `VoteCast` events should only appear for accepted transactions.
- Optional later: skip or reject `VoteCast` in projection when `status` is closed (defense in depth only).

See **architecture.mdc** §8, **event_schema.mdc** §6–7, **service_boundaries.mdc**.

## Layout

```
cmd/aggregator/          Lambda entrypoint (bootstrap)
internal/
  configs/               Environment configuration
  app/
    domain/              Event types and SNS unwrap
    handlers/            SQS Lambda handler
    service/             Projection orchestration
    repository/
      dynamodb/          AWS DynamoDB adapters
      memory/            In-memory store for unit tests
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DYNAMODB_PROPOSALS_TABLE` | yes | Proposals table name |
| `DYNAMODB_VOTER_ACTIVITY_TABLE` | yes | Voter activity table name |
| `DYNAMODB_PROCESSED_EVENTS_TABLE` | yes | Event deduplication table name |

`SQS_QUEUE_URL` is set in Terraform for reference; the Lambda is invoked by SQS event source mapping.

## Commands

```bash
go test ./...
go fmt ./...

# Linux Lambda binary (from this directory)
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bootstrap ./cmd/aggregator
zip aggregator-lambda.zip bootstrap
```

Set `aggregator_lambda_zip_path` in `infra/aws` to deploy.

## Terraform

The `processed_events` table uses partition key `event_id`. Aggregator IAM includes `PutItem` / `DeleteItem` on that table for deduplication with conditional writes.
