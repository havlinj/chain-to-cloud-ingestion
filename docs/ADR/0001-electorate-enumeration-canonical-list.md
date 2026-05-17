# Electorate enumeration (canonical off-chain list + list_hash)

- **Status:** Proposed
- **Context:** The on-chain program stores only `merkle_root` and `version`, not every eligible `voter_pubkey`. Auditors and voters need to answer who exactly could vote on a proposal. Phase 3 requires transparency without trusting a private admin database alone.
- **Decision:** *(To be finalized after maintainer discussion.)*
  - Admin maintains a **canonical ordered pubkey list** (file or DB) off-chain.
  - On each `update_merkle_root`, publish **`list_hash`** (e.g. SHA-256 of canonical serialized list) in `EligibleVotersRootUpdated` and/or alongside admin tooling output.
  - Merkle tree is built from that list per ADR-defined leaf rule (e.g. `keccak256(pubkey_bytes)`).
  - At `create_proposal`, snapshot fields (`electorate_merkle_root`, `electorate_registry_version`, `electorate_snapshot_slot`) are emitted; optional materialized member list deferred unless discussion chooses IPFS/CID or audit event.
  - Grant/revoke PDAs remain the on-chain source for **individual** adds/removes relative to snapshot slot.
- **Consequences:**
  - Third parties can verify list ↔ root off-chain.
  - Full enumeration is not on-chain; reliance on published list + hash discipline.
  - Ingestion and `event_schema.mdc` gain optional `list_hash` when Accepted.
- **Alternatives considered:** On-chain enumeration of all pubkeys (costly); materialized snapshot at every `create_proposal` (heavier, clearer audit).
- **References:** `architecture.mdc` §8, `event_schema.mdc` §6–8, `development_plan.mdc` §3.3.
