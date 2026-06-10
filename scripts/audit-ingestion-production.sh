#!/usr/bin/env bash
# npm audit --production for Lambda runtime deps (Ingestion only).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== npm audit (--production): services/ingestion ==="
cd "$ROOT/services/ingestion"
npm audit --production
