# Program admin multisig-capable (same chain)

- **Status:** Accepted
- **Non-goals:** Single hot-wallet admin in production; immutable program with no upgrade path for bugfixes; on-chain Realms or token-weighted DAO governance for registry changes in Phase 3.
- **Context:** Registry and eligibility mutations are controlled by a single `authority`. A lone hot wallet is unsafe for production. Multisig cannot be assumed retrofittable after an immutable deploy without a new program or upgrade path. An **upgradeable** program introduces a separate **upgrade authority**; a compromised upgrade key can replace program logic regardless of registry `authority` multisig.
- **Decision:**
  - The program exposes **`transfer_authority(new_authority)`** callable only by the current registry `authority`.
  - **Initial devnet** registry `authority` may be a single keypair for development speed.
  - **Production target** for registry `authority` is a **multisig PDA** (e.g. Squads) on the **same Solana cluster** — not a new blockchain.
  - Deploy uses Anchor **upgradeable** BPF loader where program logic may need fixes before immutability; document the initial upgrade authority holder in deploy runbooks and `docs/progress/`.
  - **No** eligibility mutation instruction (`update_merkle_root`, `grant_eligibility`, `revoke_eligibility`) succeeds without the registry `authority` signer (or multisig PDA) per instruction design.
  - **Upgrade authority mitigation (required for production, recommended from first devnet deploy):** Treat upgrade authority compromise as equivalent to full program takeover. **Production MUST** assign program **upgrade authority** to the **same multisig PDA** (or a dedicated multisig with equivalent policy) as registry `authority`, not a lone hot wallet. Devnet may start with a single upgrade key only for local iteration; before any shared/long-lived devnet, transfer upgrade authority to multisig via `solana program set-upgrade-authority` (or deploy-time config) and record the change in progress notes.
- **Consequences:**
  - Safer registry operations; additional deploy/setup steps (`transfer_authority`, multisig creation, upgrade-authority alignment).
  - **Risk — upgradeable program:** A holder of upgrade authority can deploy arbitrary replacement code. **Mitigation:** multisig (or hardware-backed multisig) on **both** registry `authority` and **upgrade authority**; least-privilege signers; document who can upgrade and how upgrades are reviewed before signing.
  - Wrong **immutable** deploy with no upgrade path → new program ID and migration on the same cluster, not a new chain.
  - On-chain Realms / token-weighted DAO governance for registry changes remains **out of scope** for Phase 3 (see Alternatives).
- **Alternatives considered:** Single admin forever (rejected for production); immutable program only (rejected — high cost of bugfix via new program ID); on-chain Realms-style governance (deferred — larger program, UX, and event surface).
- **References:** `architecture.mdc` §8, `development_plan.mdc` §3.3, `docs/planning/agreed_direction_skip_votecast.md`.
