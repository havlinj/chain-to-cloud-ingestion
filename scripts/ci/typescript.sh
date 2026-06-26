#!/usr/bin/env bash
# ADR 0004 Phase A — TypeScript test + typecheck for ingestion and tools packages.
#
# Usage:
#   scripts/ci/typescript.sh                         # all packages
#   scripts/ci/typescript.sh services/ingestion    # one package

set -euo pipefail

# shellcheck source=scripts/ci/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

load_manifest
# shellcheck disable=SC2206
TS_PACKAGES=($TS_PACKAGES)

run_typescript_package() {
  local pkg="$1"
  local dir="$ROOT/$pkg"
  if [[ ! -f "$dir/package.json" ]]; then
    die "package not found: $pkg"
  fi
  require_cmd npm "https://nodejs.org"
  log "TypeScript: $pkg"
  ci_npm_ci "$dir"
  (cd "$dir" && npm test && npm run typecheck)
}

if [[ $# -eq 0 ]]; then
  for pkg in "${TS_PACKAGES[@]}"; do
    run_typescript_package "$pkg"
  done
elif [[ $# -eq 1 ]]; then
  run_typescript_package "$1"
else
  die "usage: typescript.sh [package-path]"
fi

log "typescript passed"
