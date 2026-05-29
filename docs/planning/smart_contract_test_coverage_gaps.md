# Smart contract test coverage — gap matrix (Session 11)

Status: **working document** after audit of `programs/voting/` and `tests/voting.ts` + `tests/voting-coverage.ts`.

## How to read the matrix

| Symbol | Meaning |
|--------|---------|
| ✅ | At least one integration or unit test asserts this path |
| ⚠️ | Partially covered (regex, wrong error surface, or happy path only) |
| ❌ | No test; error may be dead code |
| 🔧 | On-chain behavior differs from enum name (documented) |

## `VotingError` × tests

| Error | Where enforced | Test status | Notes |
|-------|----------------|-------------|-------|
| `ProposalIdTooLong` | `validate_proposal_id` | ⚠️ | Empty id → this error. Len 33–64 is **unreachable** in practice: PDA seed `proposal_id.as_bytes()` is max **32 bytes** per Solana seed → fails before custom error. Consider aligning `MAX_PROPOSAL_ID_LEN` with 32 or documenting. |
| `TitleTooLong` | `validate_title` | ✅ | `voting-coverage.ts` |
| `InvalidOptions` | `validate_options` | ⚠️ | Fewer than two options ✅. Empty option / long option / too many options → `voting-coverage.ts` |
| `CommitEndsInPast` | `create_proposal` | ✅ | `voting-coverage.ts` |
| `RevealBeforeCommitEnd` | `create_proposal` | ✅ | `voting-coverage.ts` |
| `ActiveProposalExists` | `create_proposal` | ✅ | `voting.ts` |
| `NoActiveProposal` | — | ❌ | **Dead code** — not referenced in program |
| `NotCommitPhase` | `commit_vote` | ✅ | After `commit_ends_at`, after close (`voting-coverage.ts`) |
| `NotRevealPhase` | `reveal_vote` | ✅ | Before `commit_ends_at`; after `reveal_ends_at` (`voting-coverage.ts`) |
| `ProposalNotOpen` | `close`/`finalize`/`reveal` | ⚠️ | Reveal after close ✅ (`voting-coverage.ts`). Finalize after close ✅. Close twice not tested (low value). |
| `Unauthorized` | registry `has_one` | ⚠️ | `update_merkle_root` after transfer ✅. Grant/revoke unauthorized → `voting-coverage.ts` |
| `NotEligible` | `require_eligible` | ✅ | Multiple tests |
| `MerkleProofInvalid` | proof verify / length | ⚠️ | Bad proof ✅. Len > 32: on-chain check exists; integration test may fail **client-side** (Borsh) before RPC — `voting-coverage.ts` accepts either error |
| `AlreadyCommitted` | — | 🔧 | **Dead code.** Duplicate `commit_vote` fails on Anchor `init` → system **already in use**, not this enum |
| `NotCommitted` | `RevealVote` constraints | ❌ | Needs existing commitment PDA with wrong `voter`/`proposal` linkage; normal “no commit” fails earlier (missing account) |
| `AlreadyRevealed` | `reveal_vote` | ✅ | `voting-coverage.ts` |
| `InvalidReveal` | `reveal_vote` | ✅ | `voting.ts` |
| `UnknownOptionId` | `reveal_vote` | ✅ | `voting-coverage.ts` |
| `RevealNotEnded` | `finalize_proposal` | ✅ | `voting-coverage.ts` |
| `ProposalNotActive` | — | ❌ | **Dead code** |
| `AlreadyGranted` | `grant_eligibility` | ✅ | Session 10 |
| `NotGranted` | — | ❌ | **Dead code** |
| `AlreadyRevoked` | `revoke_eligibility` | ✅ | Session 10 |

## Instruction paths (non-error)

| Path | Status | Notes |
|------|--------|-------|
| Golden commit → reveal → finalize | ✅ | `voting.ts` |
| Permissionless `finalize_proposal` | ✅ | Happy path in `voting.ts`; early reject ✅ |
| `transfer_authority` | ✅ | `voting-coverage.ts` |
| Tally two voters same option | ✅ | `voting-coverage.ts` |
| Instruction log names | ⚠️ | `CreateProposal` / `CommitVote` / `RevealVote` only — **no event field assertions** |
| Anchor event payloads vs `event_schema.mdc` | ❌ | Future: parse `Program data:` or `program.addEventListener` |
| `EligibleVotersRootUpdated` / grant / revoke events | ❌ | No log/event assertions yet |
| `initialize_registry` twice | ❌ | Would fail on `init`; low priority |

## Security review (short)

| Topic | Risk | Mitigation / test |
|-------|------|-------------------|
| Duplicate commit | Medium UX | `init` on commitment PDA prevents double commit; error is generic. Consider `init_if_needed` + `AlreadyCommitted` like grant/revoke |
| `proposal_id` length vs PDA seed | Low confusion | Max 64 in validator but seed max 32 — document or align constant |
| Eligibility bypass | High | Merkle + grant/revoke snapshot rules well tested |
| Phase timing | Medium | Wall-clock checks tested; validator clock skew is environmental |
| Authority | Medium | Transfer + unauthorized root update tested; grant unauthorized added in gaps |
| One active proposal | Medium | Tested |
| Commit–reveal binding | High | Invalid salt + golden fixture tested |
| PDA re-init grant/revoke | Low | `init_if_needed` + slot guards (Session 10) |
| Close during voting | Medium | Close clears `active_proposal`; commit/reveal after close tested |

## Recommended next work (after this audit)

1. **Done in this session:** fill validation + phase-after-close + unauthorized grant + long Merkle proof tests (`voting-coverage.ts`).
2. **Optional contract hygiene:** remove dead `VotingError` variants or wire `AlreadyCommitted` via `init_if_needed` on commitment PDA.
3. **Event assertions:** one test per emitted event type with decoded fields (ingestion depends on these).
4. **Then pipeline:** Ingestion/Aggregator migration off `VoteCast` per `agreed_direction_skip_votecast.md`.

## References

- `docs/progress/session_10.md`
- `docs/planning/agreed_direction_skip_votecast.md`
- ADRs 0001–0003 (Accepted)
