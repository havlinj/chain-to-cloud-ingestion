# Eligibility admin CLI

Off-chain admin tooling for the **global voter registry**. Builds the canonical pubkey list, `list_hash`, and Merkle root using the same algorithms as `voting-crypto` and the on-chain verifier.

Specification: [`docs/ADR/0001-electorate-enumeration-canonical-list.md`](../../docs/ADR/0001-electorate-enumeration-canonical-list.md).

Shared crypto/electorate/PDA code: [`../voting-shared/`](../voting-shared/) (also used by `devnet-pipeline`).

## Prerequisites

- Node.js 20+
- For on-chain commands: Solana wallet, RPC, and Anchor IDL from `smart-contract/`:

```bash
cd smart-contract
anchor build   # produces target/idl/voting.json
```

## Install

```bash
cd tools/eligibility-admin
npm install
```

## Commands

### Build (offline)

Read a voter list (one base58 pubkey per line), canonicalize (base58 lex sort, `\n` separators), output `list_hash` and `merkle_root`:

```bash
npm run cli -- build --list voters.txt --json
npm run cli -- build --list voters.txt --write-canonical voters-canonical.txt
```

### Merkle proof (offline)

Proof for `commit_vote` for one voter in the list:

```bash
npm run cli -- proof --list voters.txt --voter <base58> --json
```

### Initialize registry (on-chain, once per deploy)

```bash
export SOLANA_RPC_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

npm run cli -- init-registry --root <merkle_root_hex_or_base58>
```

### Update Merkle root (on-chain)

Recomputes `list_hash` and `merkle_root` from the list file and submits `update_merkle_root`:

```bash
npm run cli -- update-root --list voters.txt
```

Emits `EligibleVotersRootUpdated` with `merkle_root`, `registry_version`, and `list_hash`.

### Grant / revoke (on-chain)

Incremental living-registry changes for **future** proposals:

```bash
npm run cli -- grant --voter <base58>
npm run cli -- revoke --voter <base58>
```

## Environment

| Variable            | Default                                       | Purpose                    |
| ------------------- | --------------------------------------------- | -------------------------- |
| `SOLANA_RPC_URL`    | `http://127.0.0.1:8899`                       | RPC endpoint               |
| `VOTING_PROGRAM_ID` | `VotiNG111…` (see `Anchor.toml`)              | Program id                 |
| `ANCHOR_WALLET`     | `~/.config/solana/id.json`                    | Registry authority keypair |
| `VOTING_IDL_PATH`   | `../../smart-contract/target/idl/voting.json` | Anchor IDL                 |

## Canonical list format

- One Ed25519 pubkey per line (base58).
- Empty lines ignored.
- Stored canonical form: lines sorted **lexicographically by base58 string**, joined with `\n`, no trailing newline.
- `list_hash` = SHA-256 of canonical file bytes.
- Merkle leaf = `keccak256(32-byte pubkey)`; tree built in canonical list order.

Golden vectors: `smart-contract/tests/fixtures/golden-0001-*`.

## Tests

Golden fixture tests (ADR 0001, 0003) live in [`../voting-shared/`](../voting-shared/):

```bash
cd tools/voting-shared && npm test
cd tools/eligibility-admin && npm run typecheck
```

## Operational notes

- **Authority** must match `VoterRegistry.authority` (see [`docs/ADR/0002-program-admin-multisig-capable.md`](../../docs/ADR/0002-program-admin-multisig-capable.md)).
- **Frozen electorate:** `update_merkle_root` affects **new** proposals only; open proposals keep the snapshot from `create_proposal`.
- Publish the canonical list file (or its `list_hash`) alongside each root update so third parties can verify `list_hash` ↔ `merkle_root`.
