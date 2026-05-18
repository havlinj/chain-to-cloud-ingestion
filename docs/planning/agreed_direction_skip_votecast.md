# Agreed development direction (2026-05-18)

Status: **Accepted by maintainer** — use this when planning iterations after Session 4.

## Context

Rules and `development_plan.mdc` already target **commit–reveal** and Phase 3 governance, but **Session 4** left **Ingestion/Aggregator on legacy `VoteCast`** (iteration 1). There is **no smart contract in the repo yet**. Wiring a minimal `VoteCast` program and replacing it later with a fundamentally different model would create unnecessary confusion.

## Decision

1. **Do not implement** a devnet **VoteCast** / public `vote(option_id)` program as a “Phase 1 placeholder.”
2. **Do not** build a long-lived E2E pipeline on `VoteCast` and migrate “much later.”
3. **Start the on-chain product** with the **target model** (commit–reveal; registry/eligibility per accepted ADRs), not a throwaway contract.
4. **Keep** existing repo investment where it is transport/ops, not wrong domain:
   - SNS/SQS fan-out, Terraform AWS skeleton, Ingestion adapter shape, Aggregator idempotency (`processed_events`), layering and tests patterns.
5. **Replace in one wave** (or back-to-back PRs), not months apart:
   - ADR **0001–0003** → **Accepted** (at minimum **0003** before contract; 0001/0002 as needed for registry in first vs second contract increment).
   - **`smart-contract/`** Anchor program (first deploy = target semantics).
   - **Ingestion** — parse `VoteCommitted`, `VoteRevealed`, extended `ProposalCreated`; **remove `VoteCast`** from the active path.
   - **Aggregator** — handlers for commit/reveal, `phase`, `results_visible`, participation; **delete `VoteCast`** handlers when new ones land (no dual production path).
6. **One program ID** on devnet for real governance work; document if any legacy ID exists only for archived demos.
7. **Phase 1 exit criteria** reinterpreted as: devnet vote (**commit → reveal → finalize**) → event bus → Aggregator projection → (optional) gRPC read API — **without** requiring a `VoteCast` contract.

## Order of work (canonical)

| Step | Deliverable |
|------|-------------|
| 0 | Resolve open ADR questions (hash encoding, missed reveal, phases) with maintainer |
| 1 | ADR 0001–0003 → **Accepted** |
| 2 | Anchor program in `smart-contract/` |
| 3 | Contract tests (unit + devnet) |
| 4 | Ingestion + Aggregator aligned to contract events; **remove VoteCast** |
| 5 | E2E devnet slice; `docs/progress/` session recap |

**Parallel (optional, non-blocking):** gRPC read API, CI for Go, EventBridge for Ingestion, DynamoDB `TransactWriteItems` — Phase 1 hardening, not a second contract model.

## Explicit non-goals (this direction)

- No “open wallet” devnet program treated as the real governance program.
- No permanent `VoteCast` + `VoteCommitted` dual handlers in production code paths.
- No full repo rewrite — targeted domain migration only.

## References

- `development_plan.mdc` Phase 3.3 (implementation order); Phase 1 placeholder `VoteCast` **skipped** per this note.
- `docs/progress/session_4.md` — last state before this decision.
- ADRs: `docs/ADR/0001-*.md`, `0002-*.md`, `0003-commit-reveal-voting.md` (still **Proposed** until Accepted).

## Next action when resuming

Begin with **ADR 0003** (finalize TBD fields → **Accepted**), unless maintainer chooses to Accept 0001/0002 in the same pass.
