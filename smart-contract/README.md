# Smart contract (`smart-contract/`)

Solana **Anchor** program for commit–reveal voting and Merkle voter registry (ADR 0001–0003). Off-chain pipeline: Ingestion → SNS/SQS → Aggregator.

## Layout

| Path | Role |
|------|------|
| `crates/voting-crypto/` | Pure Rust: `list_hash`, Merkle tree, vote commitment, base58 — **golden tests** |
| `programs/voting/` | Anchor program: registry, proposals, commit/reveal, events (iteration **2B**) |
| `tests/fixtures/` | ADR golden JSON/txt (regenerate via `scripts/generate_golden_fixtures.py`) |
| `Anchor.toml` | Anchor workspace config (devnet/localnet program id) |

## Quick test (no Anchor required)

```bash
cd smart-contract
cargo test -p voting-crypto
```

## Build Anchor program (iteration 2B)

Requires Rust **stable** (1.85+ Cargo) for `anchor-lang` transitive deps, plus [Anchor 0.30.1](https://www.anchor-lang.com/docs/installation) and Solana CLI for `anchor build`:

```bash
cd smart-contract
rustup run stable cargo build -p voting
# optional: anchor build
```

CI runs `cargo test -p voting-crypto` on Rust 1.78 and `cargo build -p voting` on stable (see `.github/workflows/smart-contract.yml`).

## Instructions (program API)

| Instruction | Purpose |
|-------------|---------|
| `initialize_registry` | Create `VoterRegistry` + `ProgramConfig` |
| `transfer_authority` | ADR 0002: move registry authority |
| `update_merkle_root` | Bump registry version; emit `EligibleVotersRootUpdated` |
| `grant_eligibility` / `revoke_eligibility` | Living registry PDAs + events |
| `create_proposal` | Snapshot electorate; one active proposal at a time |
| `commit_vote` | Phase `commit`; Merkle proof and/or grant PDA |
| `reveal_vote` | After `commit_ends_at`; verifies SHA-256 commitment |
| `close_proposal` | Authority early close |
| `finalize_proposal` | After `reveal_ends_at`; emit `ProposalFinalized` |

## Regenerate fixtures

```bash
cd smart-contract
python3 -m venv .venv-fixtures
.venv-fixtures/bin/pip install pycryptodome
.venv-fixtures/bin/python scripts/generate_golden_fixtures.py
```
