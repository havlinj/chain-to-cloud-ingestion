#!/usr/bin/env bash
# ADR 0004 Phase A — TypeScript test + typecheck for ingestion and tools packages.
#
# Usage:
#   scripts/ci/typescript.sh                         # all packages
#   scripts/ci/typescript.sh services/ingestion    # one package
#
# tools/voting-shared exports compiled dist/ (not src/). Dependent packages
# (eligibility-admin, devnet-pipeline) need a built voting-shared before typecheck.

set -euo pipefail

# shellcheck source=scripts/ci/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

load_manifest
# shellcheck disable=SC2206
TS_PACKAGES=($TS_PACKAGES)

ensure_voting_shared_built() {
  local shared="$ROOT/tools/voting-shared"
  ci_npm_ci "$shared"
  log "Build tools/voting-shared → dist/"
  (cd "$shared" && npm run build)
}

run_typescript_package() {
  local pkg="$1"
  local dir="$ROOT/$pkg"
  if [[ ! -f "$dir/package.json" ]]; then
    die "package not found: $pkg"
  fi
  require_cmd npm "https://nodejs.org"
  log "TypeScript: $pkg"

  case "$pkg" in
    tools/voting-shared)
      ci_npm_ci "$dir"
      (cd "$dir" && npm test && npm run typecheck && npm run build)
      ;;
    tools/eligibility-admin | tools/devnet-pipeline)
      ensure_voting_shared_built
      ci_npm_ci "$dir"
      (cd "$dir" && npm test && npm run typecheck)
      ;;
    *)
      ci_npm_ci "$dir"
      (cd "$dir" && npm test && npm run typecheck)
      ;;
  esac
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
