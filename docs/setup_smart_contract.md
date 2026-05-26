# Smart Contract Setup (Ubuntu + macOS)

This guide helps you run the same `smart-contract/` workflow on both machines (Ubuntu and macOS) with consistent toolchains.

## Prerequisites

- Git
- curl
- Node.js 20+
- npm

## 1) Install Rust (both machines)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
rustup toolchain install 1.78.0 1.85.0
```

Project notes:

- `smart-contract/rust-toolchain.toml` pins Rust `1.85.0` for host builds.
- `scripts/run-all-tests.sh` uses Rust `1.78.0` for `voting-crypto` tests (same as CI).

## 2) Install Solana/Agave CLI (3.1.x)

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.11/install)"
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Verify:

```bash
solana --version
cargo-build-sbf --version
```

## 3) Install Anchor 0.32.1 via AVM

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
```

Add to your shell profile:

```bash
export PATH="$HOME/.avm/bin:$PATH"
```

Install and select Anchor:

```bash
avm install 0.32.1
avm use 0.32.1
anchor --version
```

## 4) Create a local wallet (once per machine)

```bash
solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase --force
```

## 5) Install project dependencies

```bash
cd smart-contract
npm install
```

## 6) Run full smart-contract checks

```bash
cd smart-contract
./scripts/run-all-tests.sh
```

This runs:

1. `cargo test -p voting-crypto` (Rust 1.78)
2. `cargo build -p voting` (host build)
3. `anchor test` (integration tests on local validator)

## Optional: Rust-only quick check

```bash
cd smart-contract
SKIP_ANCHOR=1 ./scripts/run-all-tests.sh
```

## Troubleshooting

If `anchor build` or `anchor test` fails with dependency/toolchain errors:

1. Confirm Solana/Agave is 3.1.x:

   ```bash
   solana --version
   cargo-build-sbf --version
   ```

2. Confirm Anchor is 0.32.1:

   ```bash
   anchor --version
   ```

3. Confirm Rust is correct in `smart-contract/`:

   ```bash
   rustc --version
   cargo --version
   ```

4. Keep `smart-contract/Cargo.lock` from the repository (do not delete it before tests).
