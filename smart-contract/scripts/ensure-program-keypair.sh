#!/usr/bin/env bash
# Copy the canonical program keypair into target/deploy/ before build or deploy.
#
# Standard Anchor layout: keys/voting-program-keypair.json is the team source of truth;
# target/deploy/voting-keypair.json is generated output used by anchor build/deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export CARGO_TARGET_DIR="${ROOT}/target"
mkdir -p "$CARGO_TARGET_DIR"

SRC="${ROOT}/keys/voting-program-keypair.json"
DST="${ROOT}/target/deploy/voting-keypair.json"

if [[ ! -f "$SRC" ]]; then
  echo "error: missing program keypair at $SRC" >&2
  echo "Run: solana-keygen new -o $SRC --no-bip39-passphrase" >&2
  echo "Then: anchor keys sync && anchor build" >&2
  exit 1
fi

mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"
chmod 600 "$DST"

PROGRAM_ID="$(solana address -k "$DST")"
echo "Program keypair ready: ${PROGRAM_ID}"
