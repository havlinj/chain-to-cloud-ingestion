#!/usr/bin/env bash
# Read proposal projection from DynamoDB after the devnet pipeline slice.
set -euo pipefail

PROPOSAL_ID="${1:-}"
TABLE_NAME="${2:-}"
REGION="${AWS_REGION:-eu-west-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
PROJECT="${PROJECT_NAME:-voting}"

if [[ -z "$PROPOSAL_ID" ]]; then
  echo "Usage: $0 <proposal_id> [dynamodb_table_name]" >&2
  echo "Example: $0 pipeline-1710000000 voting-dev-proposals" >&2
  exit 1
fi

if [[ -z "$TABLE_NAME" ]]; then
  TABLE_NAME="${PROJECT}-${ENVIRONMENT}-proposals"
fi

echo "Querying ${TABLE_NAME} for proposal_id=${PROPOSAL_ID}..."
aws dynamodb get-item \
  --region "$REGION" \
  --table-name "$TABLE_NAME" \
  --key "{\"proposal_id\": {\"S\": \"${PROPOSAL_ID}\"}}" \
  --output json

echo ""
echo "Voter activity (if any commits/reveals):"
ACTIVITY_TABLE="${PROJECT}-${ENVIRONMENT}-voter-activity"
aws dynamodb scan \
  --region "$REGION" \
  --table-name "$ACTIVITY_TABLE" \
  --filter-expression "attribute_exists(proposals.#pid)" \
  --expression-attribute-names '{"#pid":"'"${PROPOSAL_ID}"'"}' \
  --max-items 5 \
  --output json 2>/dev/null || echo "(scan skipped — table empty or filter unsupported)"
