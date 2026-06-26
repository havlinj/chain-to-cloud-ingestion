#!/usr/bin/env bash
# ADR 0004 Phase A — smart-contract fmt, voting-crypto tests, voting host build.
# Does not run anchor test (Phase B).
#
# Usage: scripts/ci/rust-smart-contract.sh

set -euo pipefail

# shellcheck source=scripts/ci/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd cargo "https://rustup.rs"

log "Rust: smart-contract (fmt, voting-crypto, host build)"
(
  cd "$ROOT/smart-contract"
  cargo fmt --all -- --check
  cargo test -p voting-crypto
  cargo build -p voting
)

log "rust-smart-contract passed"
