#!/usr/bin/env bash
# Format (or check formatting for) all languages in this repository.
#
# Usage:
#   scripts/format-all.sh           # write formatted output
#   scripts/format-all.sh --check   # CI-style check only (exit 1 if drift)
#
# Prerequisites:
#   - repo root: npm install (Prettier)
#   - Go: gofmt on PATH (aggregator)
#   - Rust: rustup + cargo fmt (smart-contract workspace)
#   - Terraform: terraform on PATH (infra/aws, infra/gcp)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHECK=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    -h | --help)
      echo "Usage: scripts/format-all.sh [--check]"
      exit 0
      ;;
    *)
      echo "error: unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

FAIL=0

log() { printf '\n==> %s\n' "$*"; }

run_step() {
  local label="$1"
  shift
  log "$label"
  if "$@"; then
    return 0
  fi
  FAIL=1
  return 0
}

run_if_installed() {
  local cmd="$1"
  local label="$2"
  shift 2
  if command -v "$cmd" >/dev/null 2>&1; then
    run_step "$label" "$@"
  else
    log "SKIP: $label ($cmd not installed)"
  fi
}

PRETTIER="$ROOT/node_modules/.bin/prettier"
PRETTIER_PATHS=(
  services/ingestion
  tools/eligibility-admin
  tools/voting-shared
  tools/devnet-pipeline
  smart-contract/tests
)

run_prettier() {
  if [[ ! -x "$PRETTIER" ]]; then
    echo "error: Prettier not found. Run: npm install (repo root)" >&2
    exit 1
  fi

  local mode=("--write")
  if [[ "$CHECK" -eq 1 ]]; then
    mode=("--check")
  fi

  "$PRETTIER" "${mode[@]}" "${PRETTIER_PATHS[@]}"
}

run_gofmt() {
  if [[ ! -d services/aggregator ]]; then
    return 0
  fi

  if [[ "$CHECK" -eq 1 ]]; then
    local unformatted
    unformatted="$(cd services/aggregator && gofmt -l .)"
    if [[ -n "$unformatted" ]]; then
      echo "$unformatted"
      return 1
    fi
    return 0
  fi

  (cd services/aggregator && gofmt -w .)
}

run_cargo_fmt() {
  if [[ ! -f smart-contract/Cargo.toml ]]; then
    return 0
  fi

  if [[ "$CHECK" -eq 1 ]]; then
    (cd smart-contract && cargo fmt --all -- --check)
  else
    (cd smart-contract && cargo fmt --all)
  fi
}

run_terraform_fmt() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    return 0
  fi

  if [[ "$CHECK" -eq 1 ]]; then
    (cd "$dir" && terraform fmt -check -recursive)
  else
    (cd "$dir" && terraform fmt -recursive)
  fi
}

if [[ "$CHECK" -eq 1 ]]; then
  echo "Format check (TypeScript, Go, Rust, Terraform)"
else
  echo "Format all (TypeScript, Go, Rust, Terraform)"
fi

run_step "Prettier: TypeScript projects" run_prettier
run_if_installed gofmt "gofmt: services/aggregator" run_gofmt
run_if_installed cargo "cargo fmt: smart-contract" run_cargo_fmt
run_if_installed terraform "terraform fmt: infra/aws" run_terraform_fmt infra/aws
run_if_installed terraform "terraform fmt: infra/gcp" run_terraform_fmt infra/gcp

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  if [[ "$CHECK" -eq 1 ]]; then
    echo "Format check failed (exit 1). Run: scripts/format-all.sh"
  else
    echo "Format finished with errors (exit 1)."
  fi
  exit 1
fi

if [[ "$CHECK" -eq 1 ]]; then
  echo "Format check passed."
else
  echo "Format finished successfully."
fi
