#!/usr/bin/env bash
# ADR 0004 Phase A — repo-wide format check (Prettier, gofmt, cargo fmt, terraform fmt).
#
# Usage: scripts/ci/format-check.sh

set -euo pipefail

# shellcheck source=scripts/ci/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd npm "https://nodejs.org"
require_cmd go "https://go.dev/dl/"
require_cmd cargo "https://rustup.rs"
require_cmd terraform "https://developer.hashicorp.com/terraform/downloads"

ci_npm_ci "$ROOT"
log "format check (repo root)"
(cd "$ROOT" && npm run format:check)

log "format-check passed"
