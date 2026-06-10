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

### Repo dependency audit (scaffolding only)

- **`scripts/audit-deps.sh`**, **`scripts/audit-ingestion-production.sh`**, root **`npm run audit`** / **`audit:production`**; per-package **`npm run audit`**.
- Documented in root **`README.md`** (Developer tooling).
- **Execution deferred** until after devnet pipeline slice — see [`docs/planning/deferred_dependency_audit_and_ci.md`](../planning/deferred_dependency_audit_and_ci.md).

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

1. **Devnet + AWS E2E slice** — chain tx → Ingestion → SNS/SQS → Aggregator/DynamoDB (Phase 3 step 7).
2. **Self-audit workshop** — after E2E slice and on-chain surface stable (step 9).
3. gRPC read API, Aggregator eligibility audit projection.
4. Dependency audit **triage** and CI gates (deferred; tooling ready).

## Next Steps

1. **Devnet + AWS pipeline slice** — deploy or use devnet program; real events through Ingestion and Aggregator; verify commit → reveal → finalize lifecycle.
2. **Self-audit workshop** — schedule after slice is green (`development_plan.mdc` step 9).
3. **Later:** run `npm run audit` + triage; CI for `format:check` and audit policy per [`deferred_dependency_audit_and_ci.md`](../planning/deferred_dependency_audit_and_ci.md).

## References

- `docs/progress/session_14.md`
- `docs/ADR/0001-electorate-enumeration-canonical-list.md`
- `docs/planning/deferred_dependency_audit_and_ci.md`
- `.cursor/rules/development_plan.mdc` Phase 3 steps 4, 7, 9
