#!/usr/bin/env bash
# Dependency vulnerability scans for all languages in this repo.
# Go (govulncheck) and Rust (cargo audit) are skipped with a notice when not installed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0

run_npm_audit() {
  local dir="$1"
  shift
  echo ""
  echo "=== npm audit: ${dir} ==="
  if (cd "$dir" && npm audit "$@"); then
    :
  else
    FAIL=1
  fi
}

run_if_installed() {
  local label="$1"
  local cmd="$2"
  shift 2
  echo ""
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "=== ${label} ==="
    if "$@"; then
      :
    else
      FAIL=1
    fi
  else
    echo "=== SKIP: ${label} (${cmd} not installed) ==="
  fi
}

run_cargo_audit() {
  echo ""
  if cargo audit --version >/dev/null 2>&1; then
    echo "=== cargo audit: smart-contract ==="
    if (cd smart-contract && cargo audit); then
      :
    else
      FAIL=1
    fi
  else
    echo "=== SKIP: cargo audit (cargo install cargo-audit) ==="
  fi
}

echo "Dependency audit (TypeScript, Go, Rust)"

run_npm_audit "services/ingestion"
run_npm_audit "tools/eligibility-admin"
run_npm_audit "smart-contract"

run_if_installed "govulncheck: services/aggregator" govulncheck \
  bash -c "cd services/aggregator && govulncheck ./..."

run_cargo_audit

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "Audit finished with reported vulnerabilities (exit 1)."
  exit 1
fi

echo "Audit finished with no reported vulnerabilities."
