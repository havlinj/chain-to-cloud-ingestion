# Ingestion Service

TypeScript AWS Lambda adapter: Solana program transactions → canonical JSON events → SNS.

## Responsibilities

- Poll Solana RPC for recent transactions to the voting program
- Decode **Anchor `emit!` events** from transaction logs (IDL: `src/idl/voting.json`)
- Normalize to the canonical envelope (`event_id`, `event_type`, `timestamp`, `source`, `version`)
- Publish to SNS (fan-out to Aggregator and Forwarder queues)

## Supported event types

- `ProposalCreated`, `VoteCommitted`, `VoteRevealed`, `ProposalClosed`, `ProposalFinalized`
- `EligibleVotersRootUpdated`, `VoterEligibilityGranted`, `VoterEligibilityRevoked`

Legacy **`VoteCast`** is not supported.

## Commands

```bash
cd services/ingestion
npm install
npm test
npm run typecheck
npm run package   # build dist/handler.mjs + ingestion-lambda.zip
```

## Configuration

Environment variables (see `src/config.ts`): `SNS_TOPIC_ARN`, `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, `LOOKBACK_SLOTS`, `EVENT_SOURCE`, `EVENT_VERSION`.

`SOLANA_PROGRAM_ID` should match the deployed voting program (default in IDL: `VotiNG1111111111111111111111111111111111111`).
