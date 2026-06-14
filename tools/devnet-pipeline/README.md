# Devnet pipeline CLI

Drives **commit → reveal → finalize** on Solana devnet to generate real chain events for the AWS ingestion slice.

Cryptography, electorate, and PDA helpers: [`../voting-shared/`](../voting-shared/).

## Commands

| Command | Purpose |
|---------|---------|
| `write-voter-list` | Write authority wallet pubkey to a one-line file |
| `bootstrap` | `initialize_registry` + `update_merkle_root` from voter list |
| `lifecycle` | Full voting lifecycle with phase waits |

## Quick start

```bash
cd tools/devnet-pipeline
npm install

export SOLANA_RPC_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

npm run cli -- write-voter-list --write-voter-list /tmp/voters.txt
npm run cli -- bootstrap --list /tmp/voters.txt
npm run cli -- lifecycle --list /tmp/voters.txt
```

Full AWS runbook: [`docs/setup_devnet_pipeline.md`](../../docs/setup_devnet_pipeline.md).

## Tests

```bash
cd tools/voting-shared && npm test   # golden fixtures (ADR 0001, 0003)
cd tools/devnet-pipeline && npm run typecheck
```
