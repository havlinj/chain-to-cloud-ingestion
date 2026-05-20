# Session 5 — Planning and documentation layout

## Context

Resumed after Session 4 (Aggregator + governance docs). No new service code or cloud deploy. Focus: align **what to build next** with the documented target (commit–reveal, Phase 3 governance) without introducing a throwaway **VoteCast** smart contract and a second migration wave.

## Implementation Summary

### Agreed development direction

- **Decision:** Do **not** implement a devnet `VoteCast` / open `vote(option_id)` program as a Phase 1 placeholder; do **not** run a long-lived E2E pipeline on `VoteCast` and migrate “much later.”
- **Rationale:** No contract exists in the repo yet; Ingestion/Aggregator `VoteCast` paths are iteration-1 transport only. The target on-chain model is fundamentally different (commit–reveal, phases, `results_visible`, eligibility per ADRs).
- **Keep:** SNS/SQS fan-out, Aggregator idempotency (`processed_events`), Ingestion adapter shape, Terraform AWS skeleton.
- **Replace in one wave** after Accepted ADRs: Anchor program → Ingestion event types → Aggregator handlers; **remove `VoteCast`** from active code paths.
- **Canonical order:** ADR 0003 (min.) → contract → contract tests → Ingestion + Aggregator → E2E devnet → progress note.
- **Recorded in:** `docs/planning/agreed_direction_skip_votecast.md`

### Documentation layout (`docs/`)

- **`docs/README.md`** — index: roles of `ADR/`, `planning/`, `progress/`; glossary (ADR, WIP, RFC); recommended flow planning → ADR → code → progress.
- **`docs/planning/README.md`** — active WIP pointers.
- **`docs/progress/README.md`** — session recap conventions.
- **Cross-links:** root `README.md`, `docs/ADR/README.md`, `.cursor/rules/agent/agent_workflow.mdc` (where agents write recaps vs. direction).
- **Git:** `ca0afb2` — *docs: organize ADR, planning, and progress folders*

### Design discussions (not in code)

- **When to “fix” the pipeline:** Phase 1 hardening (gRPC, CI, `TransactWriteItems`) can run in parallel; **domain migration** (event types, tally rules) waits for **Accepted ADRs + first target Anchor deploy**, not before.
- **Where teams put working notes:** `planning/` for WIP direction; durable choices in **Accepted ADRs**; `progress/` for backward-looking session recaps — not duplicated in new Cursor rules.
- **Phase 1 exit criteria:** reinterpreted as devnet **commit → reveal → finalize** → bus → Aggregator (optional gRPC), without a `VoteCast` contract.

## Files Touched

- `docs/README.md` (new)
- `docs/planning/README.md`, `docs/planning/agreed_direction_skip_votecast.md` (new; moved from `docs/progress/`)
- `docs/progress/README.md` (new)
- `docs/progress/session_5.md` (this file)
- `README.md`, `docs/ADR/README.md`, `.cursor/rules/agent/agent_workflow.mdc`

## Architectural Notes

- ADRs **0001–0003** remain **Proposed**; next implementation step is finalize and **Accept** (especially **0003**: hash encoding, missed reveal, phases).
- `smart-contract/` directory still empty — first deploy should match target governance model per planning note.
- Aggregator/Ingestion still implement **`VoteCast`** only until contract + migration iteration; treat as legacy iteration 1, not the product path.

## Next Steps

1. **ADR 0003** — resolve TBD fields with maintainer → status **Accepted** (0001/0002 same pass or follow-up).
2. **Anchor** scaffold in `smart-contract/` (commit–reveal; registry per ADR scope).
3. **Ingestion + Aggregator** — `VoteCommitted` / `VoteRevealed`, `results_visible`, participation; delete `VoteCast` handlers in the same wave.
4. Optional parallel: gRPC read API, Go CI, EventBridge for Ingestion.

## Commits (this session)

| Commit     | Summary |
|------------|---------|
| `ca0afb2` | docs: organize ADR, planning, and progress folders |
