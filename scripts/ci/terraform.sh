#!/usr/bin/env bash
# ADR 0004 Phase A — Terraform fmt + validate for AWS and GCP roots.
#
# Usage:
#   scripts/ci/terraform.sh       # aws + gcp
#   scripts/ci/terraform.sh aws   # one stack

set -euo pipefail

# shellcheck source=scripts/ci/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd terraform "https://developer.hashicorp.com/terraform/downloads"

load_manifest
# shellcheck disable=SC2206
TF_STACKS_ARR=($TF_STACKS)

validate_stack() {
  local stack="$1"
  local dir="$ROOT/infra/$stack"
  if [[ ! -d "$dir" ]]; then
    die "terraform root not found: infra/$stack"
  fi
  log "Terraform: infra/$stack"
  (
    cd "$dir"
    terraform fmt -check -recursive
    terraform init -backend=false -input=false
    terraform validate
  )
}

if [[ $# -eq 0 ]]; then
  for stack in "${TF_STACKS_ARR[@]}"; do
    validate_stack "$stack"
  done
elif [[ $# -eq 1 ]]; then
  case "$1" in
    aws | gcp) validate_stack "$1" ;;
    *) die "usage: terraform.sh [aws|gcp]" ;;
  esac
else
  die "usage: terraform.sh [aws|gcp]"
fi

log "terraform passed"
