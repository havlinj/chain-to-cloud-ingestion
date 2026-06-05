# Session 14 — Local pipeline E2E (commit → reveal → finalize)

## Context

Resume after Session 13. Next planned step: **E2E slice (iteration A)** — verify Ingestion normalization and Aggregator projection for the commit–reveal lifecycle without AWS/devnet deploy.

## Implementation Summary

### Ingestion (`services/ingestion/`)

- **`anchor-events.ts`:** Resolve Anchor event names via PascalCase / camelCase first-letter toggle (`resolveCanonicalEventType`); read snake_case and camelCase field names; encode `Uint8Array` and plain `number[]` byte fields as base58 (fixes real `EventParser` decode shape).
- **`pipeline-e2e.test.ts`:** Pipeline tests with inline constants and explicit asserts; act via `canonicalEventFromAnchorLogs` (`parseProgramLogs` + `normalizeChainEvent`).
- **`test-support/anchor-log-fixtures.ts`:** Build synthetic Anchor `Program data:` logs for tests (Borsh encode + IDL discriminators).

### Aggregator (`services/aggregator/`)

- **`projection_e2e_test.go`:** Lifecycle E2E — `ProposalCreated` → `VoteCommitted` → `VoteRevealed` → `ProposalFinalized`; asserts participation, tally, `results_visible`; duplicate-delivery idempotency. Act via `processPipelineEvent` (`ProcessPayload`).

## Verification

```bash
cd services/ingestion && npm test
cd services/aggregator && go test ./internal/app/service/ -run E2E -v
```

All tests green (12 ingestion, 3 aggregator E2E).

## Architectural Notes

- Proves canonical JSON contract between Ingestion output and Aggregator input for Phase 3 event types.
- Does not replace full devnet + SNS/SQS deploy (next hardening slice).
- Byte-field normalization fix applies to production Ingestion path, not tests only.

## Not Done This Session

1. **`tools/eligibility-admin/`** — Merkle builder + `list_hash` (ADR 0001).
2. **Devnet + AWS E2E** — deployed ingestion Lambda, SNS/SQS, DynamoDB.
3. **Self-audit workshop** — after E2E + admin tooling (see `development_plan.mdc` step 9).
4. gRPC read API, Aggregator eligibility audit projection.

## Next Steps

1. **`tools/eligibility-admin/`** — canonical list → Merkle → `update_merkle_root`.
2. Devnet + AWS pipeline slice (optional before or after admin tooling).
3. Self-audit workshop when on-chain surface is stable.

## References

- `docs/progress/session_13.md`
- `.cursor/rules/development_plan.mdc` Phase 3 step 7
- ADR **0003** golden commitment vector (voter + commitment in tests)
