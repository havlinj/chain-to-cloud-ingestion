#!/usr/bin/env bash
# ADR 0004 Phase A — Aggregator Go unit tests.
#
# Usage: scripts/ci/go-aggregator.sh

set -euo pipefail

# shellcheck source=scripts/ci/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd go "https://go.dev/dl/"

log "Go: services/aggregator"
(cd "$ROOT/services/aggregator" && go test ./...)

log "go-aggregator passed"
