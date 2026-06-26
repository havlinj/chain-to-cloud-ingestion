#!/usr/bin/env bash
# ADR 0004 Phase A — run the same checks as .github/workflows/ci.yml (locally or in Actions).
#
# Usage:
#   scripts/ci/ci.sh                              # all checks
#   scripts/ci/ci.sh format-check typescript      # subset
#   scripts/ci/ci.sh typescript services/ingestion  # one TS package (delegates to typescript.sh)
#
# Environment:
#   SKIP_NPM_CI=1   Skip npm ci when dependencies are already installed
#
# Individual scripts (callable from GitHub Actions jobs):
#   scripts/ci/format-check.sh
#   scripts/ci/typescript.sh [package]
#   scripts/ci/go-aggregator.sh
#   scripts/ci/rust-smart-contract.sh
#   scripts/ci/terraform.sh [aws|gcp]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/ci/common.sh
source "$SCRIPT_DIR/common.sh"

ALL_CHECKS=(
  format-check
  typescript
  go-aggregator
  rust-smart-contract
  terraform
)

usage() {
  cat <<'EOF'
Usage: scripts/ci/ci.sh [check ...] [check-arg]

Runs the same checks as GitHub Actions (see docs/ci.md).

Checks (default: all):
  format-check          Repo-wide format (Prettier, gofmt, cargo fmt, terraform fmt)
  typescript [pkg]      npm test + typecheck (all TS packages, or one path)
  go-aggregator         go test ./... in services/aggregator
  rust-smart-contract   cargo fmt, voting-crypto tests, voting host build
  terraform [aws|gcp]   terraform fmt + validate (both stacks, or one)

Environment:
  SKIP_NPM_CI=1         Skip npm ci when deps are already installed

Examples:
  scripts/ci/ci.sh
  scripts/ci/ci.sh format-check go-aggregator
  scripts/ci/typescript.sh tools/voting-shared
  SKIP_NPM_CI=1 scripts/ci/ci.sh
EOF
}

run_check() {
  local check="$1"
  shift
  case "$check" in
    format-check)
      bash "$SCRIPT_DIR/format-check.sh"
      ;;
    typescript)
      bash "$SCRIPT_DIR/typescript.sh" "$@"
      ;;
    go-aggregator)
      bash "$SCRIPT_DIR/go-aggregator.sh"
      ;;
    rust-smart-contract)
      bash "$SCRIPT_DIR/rust-smart-contract.sh"
      ;;
    terraform)
      bash "$SCRIPT_DIR/terraform.sh" "$@"
      ;;
    -h | --help | help)
      usage
      exit 0
      ;;
    *)
      die "unknown check: $check (run scripts/ci/ci.sh --help)"
      ;;
  esac
}

if [[ $# -eq 0 ]]; then
  for check in "${ALL_CHECKS[@]}"; do
    run_check "$check"
  done
  log "all CI checks passed"
  exit 0
fi

if [[ "$1" == "-h" || "$1" == "--help" || "$1" == "help" ]]; then
  usage
  exit 0
fi

while [[ $# -gt 0 ]]; do
  check="$1"
  shift
  case "$check" in
    typescript)
      if [[ $# -gt 0 && ("$1" == tools/* || "$1" == services/*) ]]; then
        run_check typescript "$1"
        shift
      else
        run_check typescript
      fi
      ;;
    terraform)
      if [[ $# -gt 0 && ("$1" == aws || "$1" == gcp) ]]; then
        run_check terraform "$1"
        shift
      else
        run_check terraform
      fi
      ;;
    *)
      run_check "$check"
      ;;
  esac
done

log "selected CI checks passed"
