#!/usr/bin/env bash
# Run all smart-contract tests: voting-crypto (Rust), host build, Anchor integration (local validator).
#
# Prerequisites: Rust stable, Node.js 20+, Solana CLI 3.1.x, Anchor 0.32.1 (avm), npm deps.
# See smart-contract/README.md for install notes.
#
# Usage (from repo root or smart-contract/):
#   ./scripts/run-all-tests.sh
#   SKIP_ANCHOR=1 ./scripts/run-all-tests.sh   # Rust-only (no validator)
#   SKIP_HOST_BUILD=1 ./scripts/run-all-tests.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Avoid inheriting a sandbox CARGO_TARGET_DIR from the IDE; pin deploy artifacts here.
export CARGO_TARGET_DIR="${ROOT}/target"
mkdir -p "$CARGO_TARGET_DIR"

export PATH="${HOME}/.local/share/solana/install/active_release/bin:${HOME}/.avm/bin:${PATH}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1 ($2)"
}

resolve_anchor() {
  if command -v anchor-0.32.1 >/dev/null 2>&1; then
    echo "anchor-0.32.1"
    return
  fi
  if command -v anchor >/dev/null 2>&1; then
    local ver
    ver="$(anchor --version 2>/dev/null || true)"
    if [[ "$ver" == *"0.32.1"* ]]; then
      echo "anchor"
      return
    fi
    die "anchor found but not 0.32.1 ($ver). Run: avm install 0.32.1 && avm use 0.32.1"
  fi
  die "Anchor 0.32.1 not found. Install avm, then: avm install 0.32.1 && avm use 0.32.1"
}

ensure_wallet() {
  local wallet="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
  if [[ -f "$wallet" ]]; then
    return
  fi
  log "Creating default Solana wallet at $wallet (for anchor test)"
  mkdir -p "$(dirname "$wallet")"
  solana-keygen new --outfile "$wallet" --no-bip39-passphrase --force
}

# --- voting-crypto (matches CI: Rust 1.78) ---
log "voting-crypto: cargo test -p voting-crypto (Rust 1.78)"
need_cmd rustup "https://rustup.rs"
rustup run 1.78.0 cargo test -p voting-crypto

# --- host build (matches CI: stable) ---
if [[ "${SKIP_HOST_BUILD:-}" != "1" ]]; then
  log "voting program: cargo build -p voting (host, stable)"
  need_cmd rustup "https://rustup.rs"
  rustup run stable cargo build -p voting
fi

if [[ "${SKIP_ANCHOR:-}" == "1" ]]; then
  log "SKIP_ANCHOR=1 — skipping npm install and anchor test"
  log "All requested smart-contract tests passed."
  exit 0
fi

# --- Anchor integration tests ---
need_cmd node "https://nodejs.org"
need_cmd solana "Solana CLI — see README toolchain section"
ANCHOR_BIN="$(resolve_anchor)"
log "Anchor integration: $ANCHOR_BIN test (Solana: $(solana --version | head -1))"

if [[ ! -d node_modules ]]; then
  log "npm install"
  npm install
fi

ensure_wallet

log "Ensuring program keypair (keys/ → target/deploy/)"
chmod +x scripts/ensure-program-keypair.sh
./scripts/ensure-program-keypair.sh

log "$ANCHOR_BIN test"
"$ANCHOR_BIN" test

log "All smart-contract tests passed."
