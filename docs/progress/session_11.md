# Session 11 — Smart contract test coverage audit + gap tests

## Context

Continue after Session 10. Session 9/10 left explicit next steps: review the Anchor suite for remaining gaps, map `VotingError` to tests, and do a short contract security review before moving to Ingestion/Aggregator migration.

## Implementation Summary

### Coverage audit

- Built a **gap matrix** (`VotingError` × integration tests × instruction paths) in `docs/planning/smart_contract_test_coverage_gaps.md`.
- Short **security review** in the same doc (duplicate commit surface, `proposal_id` vs PDA seed limit, eligibility, phase timing, authority).

### New integration tests (merged into `smart-contract/tests/voting-coverage.ts`)

- **13 tests** added under existing `describe` blocks (eligibility, phases, registry validation).
- Initially added in a separate `voting-gaps.ts` file during the audit; refactored into `voting-coverage.ts` so tests stay grouped by domain, not by “gap ticket”.
- **create_proposal** validation: empty `proposal_id` / title, title too long, empty or long option label, more than `MAX_OPTIONS`.
- **After close:** commit → `NotCommitPhase`; reveal / finalize → `ProposalNotOpen`.
- **Reveal window:** reveal after `reveal_ends_at` → `NotRevealPhase`.
- **Registry:** non-authority `grant_eligibility` → `Unauthorized`.
- **Duplicate commit:** documents system `already in use` (Anchor `init` on commitment PDA), not `AlreadyCommitted`.
- **Long Merkle proof:** client may reject before RPC (Borsh); on-chain limit still `MAX_MERKLE_PROOF_LEN`.

### Findings (for follow-up)

| Topic | Finding |
|-------|---------|
| Dead `VotingError` | `NoActiveProposal`, `ProposalNotActive`, `NotGranted`, `AlreadyCommitted` — not referenced in program |
| Duplicate commit | `CommitVote` uses `init`; second commit fails with system error, not `AlreadyCommitted` |
| `proposal_id` length | Validator allows up to 64 chars; PDA seed max **32 bytes** — ids 33–64 are practically unreachable |
| Event payloads | No decoded Anchor event assertions yet (only instruction log name checks in coverage suite) |
| `NotCommitted` | Hard to hit via normal RPC without crafted account wiring |

## Files Touched

- `docs/planning/smart_contract_test_coverage_gaps.md` (new)
- `smart-contract/tests/voting-coverage.ts`
- `docs/progress/session_11.md` (this file)

## Verification

```bash
cd smart-contract
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
export CARGO_TARGET_DIR="$PWD/target"
anchor test --skip-build   # 39 passing (26 existing + 13 new)
```

## Not Done This Session

1. **On-chain hygiene** — `init_if_needed` + `AlreadyCommitted` on commitment PDA (mirror Session 10 grant/revoke); align `MAX_PROPOSAL_ID_LEN` with 32-byte PDA seed; remove or wire dead `VotingError` variants.
2. **Event payload tests** — decode `ProposalCreated`, `VoteCommitted`, `VoteRevealed`, eligibility events and assert fields vs `event_schema.mdc` / ADRs.
3. **Deeper security pass** — formal threat-model write-up or ADR only if behavior changes.
4. **Pipeline migration** — Ingestion/Aggregator off `VoteCast` per `docs/planning/agreed_direction_skip_votecast.md`.
5. **Eligibility admin tooling** — `tools/eligibility-admin/` (Phase 3 plan step 4).

## Next Steps (resume here)

1. **Optional contract PR** — commitment PDA idempotency + `MAX_PROPOSAL_ID_LEN` ≤ 32 + dead error cleanup; re-run full `anchor test`.
2. **Event assertions** — one integration test per emitted event type (unblocks Ingestion confidently).
3. **Then pipeline** — Ingestion parsers for `VoteCommitted` / `VoteRevealed`; Aggregator handlers + remove `VoteCast` production path.

## References

- `docs/planning/smart_contract_test_coverage_gaps.md`
- `docs/planning/agreed_direction_skip_votecast.md`
- `docs/progress/session_10.md`
