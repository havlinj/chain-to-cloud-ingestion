# Session 15 — Eligibility admin CLI (`tools/eligibility-admin/`)

## Context

Continue Phase 3 step 4 per `development_plan.mdc` and Session 14 next steps: admin tooling to build canonical voter list, `list_hash`, and Merkle root (ADR **0001**) and submit on-chain registry updates.

## Implementation Summary

### `tools/eligibility-admin/` (TypeScript)

- **`src/electorate.ts`** — Parse voter list; canonicalize (base58 lex sort, `\n` join); `list_hash` (SHA-256); Merkle root/leaves (ADR 0001).
- **`src/merkle.ts`** — `merkleLeaf`, `merkleRoot`, `buildMerkleProof` (matches `voting-crypto`).
- **`src/chain.ts`** — Anchor client: `initialize_registry`, `update_merkle_root`, `grant_eligibility`, `revoke_eligibility`.
- **`src/cli.ts`** — Commands: `build`, `proof`, `init-registry`, `update-root`, `grant`, `revoke`.
- **`src/electorate.test.ts`** / **`src/chain.test.ts`** — Golden fixtures plus parse and `parseBytes32` error-path tests; no RPC.
- **`README.md`** — Runbook: canonical list format, env vars, examples.
- **Follow-up:** slim `ElectorateBuildResult` (canonical bytes + `Uint8Array` roots; hex/base58 via format helpers); per-command `--help` descriptions; layered config merge in `chain.ts`.

### Repo formatting

- **Prettier** at repo root (`.prettierrc.json`, `npm run format` / `format:check`) for `services/ingestion/`, `tools/eligibility-admin/`, `smart-contract/tests/`.
- **`gofmt`** on `services/aggregator/`; **`cargo fmt`** on `smart-contract/`; existing **`terraform fmt`** unchanged (already clean).

## Verification

```bash
cd tools/eligibility-admin
npm install
npm test
npm run typecheck
npm run cli -- build --list ../../smart-contract/tests/fixtures/golden-0001-voter-list-input.txt --json

# repo root
npm install
npm run format:check
```

## Architectural Notes

- Offline `build` / `proof` match `voting-crypto` and on-chain verifier; golden vectors in `smart-contract/tests/fixtures/`.
- On-chain commands require `anchor build` IDL at `smart-contract/target/idl/voting.json`.
- `update_merkle_root` publishes `list_hash` on-chain via `EligibleVotersRootUpdated` event.
- Grant/revoke affect the **living** registry only; open proposals keep frozen electorate.

## Not Done This Session

1. **Devnet + AWS E2E** — deployed ingestion Lambda, SNS/SQS, DynamoDB.
2. **Self-audit workshop** — after on-chain surface stable (step 9).
3. gRPC read API, Aggregator eligibility audit projection.
4. CI workflow for `tools/eligibility-admin` tests and `npm run format:check`.

## Next Steps

1. Devnet + AWS pipeline slice (commit → reveal → finalize through real event bus).
2. Optional: CI job for `tools/eligibility-admin` `npm test`.
3. Self-audit workshop when ready.

## References

- `docs/progress/session_14.md`
- `docs/ADR/0001-electorate-enumeration-canonical-list.md`
- `.cursor/rules/development_plan.mdc` Phase 3 step 4
