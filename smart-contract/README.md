# Smart contract (`smart-contract/`)

Solana **Anchor** program for commit–reveal voting and Merkle voter registry (ADR 0001–0003). Off-chain pipeline: Ingestion → SNS/SQS → Aggregator.

## Layout

| Path | Role |
|------|------|
| `crates/voting-crypto/` | Pure Rust: `list_hash`, Merkle tree, vote commitment, base58 — **golden tests** |
| `programs/voting/` | Anchor program: registry, proposals, commit/reveal, events (iteration **2B**) |
| `tests/` | Anchor integration tests (TypeScript, iteration **2C**) |
| `tests/fixtures/` | ADR golden JSON/txt (regenerate via `scripts/generate_golden_fixtures.py`) |
| `Anchor.toml` | Anchor workspace config (devnet/localnet program id) |
| `keys/voting-program-keypair.json` | Canonical program deploy keypair (committed; see `keys/README.md`) |

## Program id (standard Anchor workflow)

The on-chain program id is the public key of `keys/voting-program-keypair.json`. `declare_id!` in `programs/voting/src/lib.rs` and `[programs.*]` in `Anchor.toml` must stay in sync with that keypair.

```bash
cd smart-contract
./scripts/ensure-program-keypair.sh   # copy keys/ → target/deploy/
anchor keys list                      # verify id
anchor build
```

After rotating the keypair: `anchor keys sync`, rebuild, then update ingestion IDL (`services/ingestion/src/idl/voting.json`), Terraform `solana_program_id`, and tool defaults.

## Run all tests (one script)

From `smart-contract/` (needs Solana 3.1.x + Anchor 0.32.1 on `PATH`; see below):

```bash
cd smart-contract
./scripts/run-all-tests.sh
```

Runs in order: `cargo test -p voting-crypto` (Rust 1.78, same as CI) → `cargo build -p voting` (stable) → `anchor test` (TypeScript + local validator). Options:

- `SKIP_ANCHOR=1` — Rust only, no validator
- `SKIP_HOST_BUILD=1` — skip host `cargo build`

## Quick test (no Anchor required)

```bash
cd smart-contract
cargo test -p voting-crypto
```

## Build Anchor program (iteration 2B)

Requires Rust **stable**, **Anchor 0.32.1**, and **Solana 3.1.x** (see toolchain note above):

```bash
cd smart-contract
./scripts/ensure-program-keypair.sh
rustup run stable cargo build -p voting   # host check only
anchor build                            # SBF artifact in target/deploy/
```

CI runs `cargo test -p voting-crypto` on Rust 1.78 and `cargo build -p voting` on stable (see `.github/workflows/smart-contract.yml`).

## Anchor integration tests (iteration 2C)

Requires **Anchor 0.32.1**, **Solana CLI 3.1.x** (platform-tools rustc ≥ 1.85 — needed for current `crates.io` deps), Rust **stable**, Node.js 20+, and a default wallet at `~/.config/solana/id.json`.

`Anchor.toml` pins `[toolchain] anchor_version = "0.32.1"` and `solana_version = "3.1.15"`. Anchor **0.30.1 + Solana 1.18** fails on modern hosts (edition2024 / `anchor-syn` / BPF heap).

```bash
# ~/.bashrc (after avm + solana install)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
avm use 0.32.1
# If `anchor --version` still shows an older release, call the versioned binary:
#   ~/.avm/bin/anchor-0.32.1 test

solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase --force  # once

cd smart-contract
npm install
anchor test   # or: ~/.avm/bin/anchor-0.32.1 test
```

Offline check (golden crypto only, no validator):

```bash
npm install
npx ts-node --transpile-only -e "
const c = require('./tests/helpers/crypto');
const f = require('./tests/helpers/fixtures');
const e = f.loadElectorateGolden();
const leaves = e.pubkeys_hex.map(h => c.merkleLeaf(c.hexToBytes32(h)));
if (Buffer.from(c.merkleRoot(leaves)).toString('hex') !== e.merkle_root_keccak256_hex) throw new Error('merkle');
const g = f.loadCommitmentGolden();
const d = c.voteCommitment(g.proposal_id, c.hexToBytes32(g.salt_hex), c.hexToBytes32(g.voter_pubkey_hex), g.option_id);
if (Buffer.from(d).toString('hex') !== g.sha256_hex) throw new Error('commitment');
console.log('OK');
"
```

Covers: golden ADR vectors in TS, commit → reveal → finalize, ineligible voter, invalid reveal, single active proposal.

### Toolchain troubleshooting

`anchor build` / `anchor test` use **Solana’s bundled Cargo** (`cargo-build-sbf`), not only `rustup` stable. If you see:

- `edition2024` required (often `indexmap v2.14.0`), or
- `rustc 1.84.x-dev is not supported` (e.g. `unicode-segmentation` needs 1.85),

then:

1. **Upgrade Solana to Agave 3.1.x** (not 2.3.x):

   ```bash
   sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.11/install)"
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   cargo-build-sbf --version   # platform-tools v1.52+, rustc ~1.89
   ```

2. **Use the repo `Cargo.lock`** (pins `indexmap` 2.13 and `unicode-segmentation` 1.12 for SBF Cargo 1.84). After `git pull`, do not delete `Cargo.lock` before `anchor test`.

3. Host Rust for `cargo build -p voting`: **≥ 1.85** (`smart-contract/rust-toolchain.toml` pins `1.85.0`). `rustup update` alone does **not** fix SBF builds if Solana stays on 2.3.

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
