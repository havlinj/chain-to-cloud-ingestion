#!/usr/bin/env bash
# Build the Aggregator Lambda zip (provided.al2023 / bootstrap).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUTPUT="${1:-$ROOT/aggregator-lambda.zip}"

rm -f bootstrap "$OUTPUT"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bootstrap ./cmd/aggregator
chmod +x bootstrap
zip -j "$OUTPUT" bootstrap
rm -f bootstrap

echo "Packaged $OUTPUT"
