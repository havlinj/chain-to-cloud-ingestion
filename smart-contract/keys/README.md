# Program deploy keypair

`voting-program-keypair.json` is the **canonical program keypair** for the voting Anchor program.

Its public key is the on-chain program id (`declare_id!` in `programs/voting/src/lib.rs` and `[programs.*]` in `Anchor.toml`).

## Standard workflow

1. Before `anchor build` or deploy, sync the keypair into `target/deploy/`:

   ```bash
   ./scripts/ensure-program-keypair.sh
   ```

2. After generating a **new** keypair (first-time setup on a machine), align source and config:

   ```bash
   anchor keys sync
   anchor build
   ```

3. Copy the updated id into downstream consumers (ingestion IDL, Terraform `solana_program_id`, tool defaults).

## Notes

- This file is the **program deploy key**, not your funded wallet (`~/.config/solana/id.json`).
- The repo commits it so every developer and CI deploys to the **same program id** on devnet/localnet.
- If you rotate the program id, replace this file, run `anchor keys sync`, rebuild, and update ingestion/terraform/tool references.
