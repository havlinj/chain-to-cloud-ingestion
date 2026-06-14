#!/usr/bin/env bash
# Deploy the voting program to Solana devnet.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export CARGO_TARGET_DIR="${ROOT}/target"
mkdir -p "$CARGO_TARGET_DIR"

echo "Ensuring program keypair..."
chmod +x scripts/ensure-program-keypair.sh
./scripts/ensure-program-keypair.sh

echo "Building program..."
anchor build

PROGRAM_ID="$(solana address -k target/deploy/voting-keypair.json)"
echo "Program id: ${PROGRAM_ID}"

echo "Setting Solana CLI to devnet..."
solana config set --url devnet

BALANCE="$(solana balance 2>/dev/null | awk '{print $1}' || echo 0)"
if awk "BEGIN { exit !($BALANCE < 2) }"; then
  echo "Requesting devnet airdrop (balance: ${BALANCE} SOL)..."
  solana airdrop 2 || solana airdrop 1
fi

echo "Deploying to devnet..."
anchor deploy \
  --provider.cluster devnet \
  --program-keypair keys/voting-program-keypair.json

echo ""
echo "Deployed program id: ${PROGRAM_ID}"
echo "Set VOTING_PROGRAM_ID / SOLANA_PROGRAM_ID to this value in Terraform and CLI tools."
