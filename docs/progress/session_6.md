# Session 6 — Accepted ADRs and golden fixtures

## Context

Resumed after Session 5 (`agreed_direction_skip_votecast.md`). Goal: start executing the canonical plan — lock governance decisions in **Accepted ADRs** before Anchor work. No new Ingestion/Aggregator or cloud deploy this session.

## Implementation Summary

### ADR 0001–0003 → Accepted

Maintainer review resolved open TBD fields; all three ADRs moved from **Proposed** to **Accepted**:

| ADR | Locked decisions (summary) |
|-----|----------------------------|
| **0001** | Canonical voter list (sorted base58 lines, LF); `list_hash` = SHA-256 of file bytes; Merkle leaf `keccak256(32-byte pubkey)`; pair rule `keccak256(min‖max)`; electorate freeze on `create_proposal`; **IPFS / materialized member list not required in v1** (future ADR optional). |
| **0002** | `transfer_authority`; devnet single key OK; production registry `authority` = multisig PDA; upgradeable deploy; **upgrade authority must use multisig in production** (same or dedicated multisig as registry). Realms/DAO governance out of scope. |
| **0003** | Commit–reveal only (no `VoteCast` placeholder); commitment = SHA-256(utf8 proposal ‖ 32B salt ‖ 32B voter ‖ utf8 option); Unix phase deadlines; `finalize_proposal`; `results_visible` after `ProposalFinalized`; missed reveal not counted; one active proposal. |

Each ADR includes a **Non-goals** line and **test vector** references (see golden fixtures below).

### Golden fixtures (`smart-contract/tests/fixtures/`)

Reference inputs/outputs for ADR algorithms (contract tests, admin tooling, CI):

| File | Role |
|------|------|
| `golden-0001-voter-list-input.txt` | Sample canonical off-chain voter list (three deterministic test pubkeys). |
| `golden-0001-list-hash-and-merkle-expected.json` | Expected `list_hash`, Merkle leaves, and root for that input. |
| `golden-0003-vote-commitment-expected.json` | Expected vote commitment for one fixed scenario. |

Regenerator: `smart-contract/scripts/generate_golden_fixtures.py` (requires `pycryptodome` in a local venv; `.venv-fixtures/` gitignored).

Test pubkeys are `0x00…01`–`03` (base58 `111111…12`–`14`) — algorithm vectors only, not devnet wallets.

### Design discussions (not in code)

- Extended rationale for ADR choices (hash encoding, phases, IPFS deferral, upgrade-authority threat model, senior-repo readiness).
- **IPFS `electorate_list_cid`:** optional later for demo/audit; freeze semantics unchanged.
- Voter identity = **Ed25519 public key**; canonical list uses **base58** as standard Solana address text (decode → 32 bytes for Merkle/commitment).
- Portfolio note: repo is **senior-in-progress** until devnet vertical slice (contract → ingestion → Aggregator without `VoteCast`) ships.

## Files Touched

- `docs/ADR/0001-electorate-enumeration-canonical-list.md`
- `docs/ADR/0002-program-admin-multisig-capable.md`
- `docs/ADR/0003-commit-reveal-voting.md`
- `docs/ADR/README.md`
- `smart-contract/.gitignore`
- `smart-contract/scripts/generate_golden_fixtures.py`
- `smart-contract/tests/fixtures/README.md`
- `smart-contract/tests/fixtures/golden-0001-voter-list-input.txt`
- `smart-contract/tests/fixtures/golden-0001-list-hash-and-merkle-expected.json`
- `smart-contract/tests/fixtures/golden-0003-vote-commitment-expected.json`
- `docs/progress/session_6.md` (this file)

## Architectural Notes

- **Accepted ADRs** are the implementation spec for the first Anchor deploy per `docs/planning/agreed_direction_skip_votecast.md`.
- `smart-contract/` has fixtures and generator only — **no Anchor program yet**.
- Aggregator/Ingestion still on **`VoteCast`** (iteration 1); migration waits for target contract + one-wave handler swap.
- Golden Merkle builder in Python must match on-chain verifier; contract tests should assert against JSON fixtures.

## Next Steps

1. **Anchor** scaffold in `smart-contract/` (registry, commit–reveal, events per Accepted ADRs).
2. Contract tests using golden fixtures (Merkle root, commitment hash).
3. **Ingestion + Aggregator** — `VoteCommitted` / `VoteRevealed`, `results_visible`, participation; remove `VoteCast` in same wave as first contract deploy.
4. E2E devnet slice: commit → reveal → finalize → SQS → DynamoDB.
5. Optional: `docs/progress/` only — push `249a66c` to remote when ready.

## Commits (this session)

| Commit     | Summary |
|------------|---------|
| `249a66c` | Accept ADRs 0001–0003 and add golden test fixtures |
