# Smart contract (`smart-contract/`)

Solana **Anchor** program for commit–reveal voting and Merkle voter registry (ADR 0001–0003). Off-chain pipeline: Ingestion → SNS/SQS → Aggregator.

## Layout (iteration 2A)

| Path | Role |
|------|------|
| `crates/voting-crypto/` | Pure Rust: `list_hash`, Merkle tree, vote commitment, base58 — **golden tests run here** |
| `programs/voting/` | Anchor program shell; will call `voting-crypto` from instructions (2B) |
| `tests/fixtures/` | ADR golden JSON/txt (regenerate via `scripts/generate_golden_fixtures.py`) |
| `Anchor.toml` | Anchor workspace config (devnet/localnet program id) |

## Quick test (no Anchor required)

```bash
cd smart-contract
cargo test -p voting-crypto
```

Building the Anchor program needs Rust **1.78+**, Anchor **0.30.1**, and Solana CLI — see [Anchor install](https://www.anchor-lang.com/docs/installation). CI runs `cargo test -p voting-crypto` only (see `.github/workflows/smart-contract.yml`); full `anchor build` is iteration **2B**.

## Regenerate fixtures

```bash
cd smart-contract
python3 -m venv .venv-fixtures
.venv-fixtures/bin/pip install pycryptodome
.venv-fixtures/bin/python scripts/generate_golden_fixtures.py
```
