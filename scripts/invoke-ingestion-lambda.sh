#!/usr/bin/env bash
# Manually invoke the Ingestion Lambda (faster than waiting for EventBridge).
set -euo pipefail

FUNCTION_NAME="${1:-}"
REGION="${AWS_REGION:-eu-west-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
PROJECT="${PROJECT_NAME:-voting}"

if [[ -z "$FUNCTION_NAME" ]]; then
  FUNCTION_NAME="${PROJECT}-${ENVIRONMENT}-ingestion"
fi

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

echo "Invoking ${FUNCTION_NAME} in ${REGION}..."
aws lambda invoke \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  "$OUT"

echo "Response:"
cat "$OUT"
echo ""
