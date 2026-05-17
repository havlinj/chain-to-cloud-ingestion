# Program admin multisig-capable (same chain)

- **Status:** Proposed
- **Context:** Registry and eligibility mutations are controlled by a single `authority`. A lone hot wallet is unsafe for production. Multisig cannot be assumed retrofittable after an immutable deploy without a new program or upgrade path.
- **Decision:** *(To be finalized after maintainer discussion.)*
  - Phase 3 program exposes **`transfer_authority(new_authority)`** callable only by current authority.
  - Initial devnet authority may be a single key; production target is a **multisig PDA** (e.g. Squads) on the **same Solana cluster** — not a new blockchain.
  - Program deploy uses **upgradeable** pattern where policy changes are anticipated; document upgrade authority holder.
  - No eligibility mutation instructions without authority signer check.
- **Consequences:**
  - Safer operations; slightly more deploy/setup complexity.
  - Wrong immutable deploy → new program ID migration on same chain, not “new chain.”
- **Alternatives considered:** Single admin forever (rejected for prod); on-chain Realms-style governance (deferred, heavier).
- **References:** `architecture.mdc` §8, `development_plan.mdc` §3.3.
