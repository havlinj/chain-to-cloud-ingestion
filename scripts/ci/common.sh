#!/usr/bin/env bash
# Shared helpers for CI scripts (local + GitHub Actions).

CI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$CI_SCRIPT_DIR/../.." && pwd)"

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  local hint="${2:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    return 0
  fi
  if [[ -n "$hint" ]]; then
    die "missing command: $cmd ($hint)"
  fi
  die "missing command: $cmd"
}

load_manifest() {
  # shellcheck source=scripts/ci/manifest.env
  source "$CI_SCRIPT_DIR/manifest.env"
}

ci_npm_ci() {
  local dir="${1:-$ROOT}"
  if [[ "${SKIP_NPM_CI:-}" == "1" ]]; then
    log "SKIP_NPM_CI=1 — skipping npm ci in $dir"
    return 0
  fi
  log "npm ci ($dir)"
  (cd "$dir" && npm ci)
}
