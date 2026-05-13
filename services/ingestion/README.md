# Ingestion Service (TypeScript)

AWS Lambda adapter that polls Solana program transactions, normalizes contract events to the canonical JSON envelope, and publishes them to SNS.

## Responsibilities

- Connect to Solana RPC
- Parse program logs into `ProposalCreated`, `VoteCast`, and `ProposalClosed`
- Add required metadata (`event_id`, `timestamp`, `source`, `version`)
- Publish to SNS

No business logic, projections, or database access.

## Layout

```
src/
  handler.ts              Lambda entrypoint
  config.ts               Environment configuration
  app/ingest.ts           Orchestration
  domain/events.ts        Event types and normalization
  blockchain/             Solana fetch + log parsing
  publisher/sns.ts        SNS publisher
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SNS_TOPIC_ARN` | yes | Target SNS topic ARN |
| `SOLANA_RPC_URL` | yes | Solana RPC endpoint |
| `SOLANA_PROGRAM_ID` | yes | Voting program public key |
| `INGESTION_LOOKBACK_SLOTS` | no | Slot lookback window (default `50`) |
| `EVENT_SOURCE` | no | Event `source` field (default `voting-contract`) |
| `EVENT_VERSION` | no | Event schema version (default `1`) |

## Contract Log Format

Until Anchor IDL-based parsing is added, the service expects program logs like:

```
Program log: {"event_type":"VoteCast","proposal_id":"p1","option_id":"1","voter_pubkey":"..."}
```

Ingestion adds `event_id`, `timestamp`, `source`, `version`, and for `VoteCast` also `slot` and `tx_signature`.

## Commands

```bash
npm install
npm test
npm run typecheck
npm run package
```

`npm run package` produces `ingestion-lambda.zip` for Terraform (`ingestion_lambda_zip_path`).

## Terraform

Set `ingestion_lambda_zip_path` to the zip path and provide `solana_rpc_url` / `solana_program_id` variables in `infra/aws`.

The Lambda uses runtime `nodejs20.x` and handler `handler.handler`.

## Local Notes

The handler is designed for scheduled invocation (for example EventBridge). A long-lived WebSocket subscriber can be added later without changing the normalization or publish layers.
