# Session 10 — Grant/revoke idempotency + toolchain fixes

## Context

Continue after Session 9. The immediate goal was to make duplicate `grant_eligibility` / `revoke_eligibility` return **program errors** (`AlreadyGranted` / `AlreadyRevoked`) instead of the system `already in use`, and ensure `anchor test` is reliably runnable across machines (macOS + Ubuntu).

## Implementation Summary

### On-chain (`smart-contract/programs/voting/`)

- Switched grant/revoke marker accounts to **`init_if_needed`** and added explicit guards:
  - `GrantedVoter.granted_at_slot == 0` → else `AlreadyGranted`
  - `RevokedVoter.revoked_at_slot == 0` → else `AlreadyRevoked`
- Removed the previous manual PDA allocation/serialization attempt (`eligibility_pda.rs`).
- Enabled Anchor `init_if_needed` support via `anchor-lang` feature `init-if-needed`.

### Toolchain stability (Anchor / SBF)

Anchor integration tests depend on Solana’s bundled SBF toolchain (`cargo-build-sbf`), not only the host `rustup` toolchain.

To avoid failures caused by the SBF Cargo/Rust version (e.g. deps requiring edition2024 / Rust 1.85), the lockfile was updated to keep compatible versions:

- `indexmap` downgraded to `2.13.0`
- `unicode-segmentation` downgraded to `1.12.0`

Additionally:

- `smart-contract/rust-toolchain.toml` pins host Rust to `1.85.0`.
- `smart-contract/README.md` was updated with a troubleshooting section explaining Agave 3.1.x setup and why `Cargo.lock` matters.

### Docs

- Added a dedicated setup guide for developing the smart contract on both Ubuntu and macOS:
  - `docs/setup_smart_contract.md`

## Files Touched

- `smart-contract/programs/voting/src/state.rs`
- `smart-contract/programs/voting/src/instructions/registry.rs`
- `smart-contract/programs/voting/src/lib.rs`
- `smart-contract/programs/voting/Cargo.toml`
- `smart-contract/rust-toolchain.toml`
- `smart-contract/Cargo.lock`
- `smart-contract/README.md`
- `docs/setup_smart_contract.md`

## Verification

On the maintainer machine:

```bash
cd smart-contract
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
export CARGO_TARGET_DIR="$PWD/target"
anchor test   # 26 passing
```

## Notes

- `init_if_needed` is safe here because we guard re-initialization by checking the `*_at_slot` fields before writing.
- The system remains aligned with ADR 0001–0003: grant/revoke are markers for eligibility evaluation and transparency, while enforcement still happens at `commit_vote`.

## Next Steps

1. Review the Anchor suite for remaining gaps (errors, negative cases, event payload assertions).
2. Do a short contract security review (PDA squatting/re-init, authority flow, phase edge-cases).
