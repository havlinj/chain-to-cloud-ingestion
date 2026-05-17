# Commit–reveal voting

- **Status:** Proposed
- **Context:** Public on-chain `vote(option_id)` exposes live tallies to any chain reader and voter UI, influencing outcomes. The project requires auditable governance without interim public scores for voter-facing channels.
- **Decision:** *(To be finalized after maintainer discussion.)*
  - Replace single-step `vote` with **`commit_vote`** then **`reveal_vote`**.
  - Commitment: `hash(option_id ‖ salt ‖ voter_pubkey ‖ proposal_id)` (exact encoding TBD).
  - Proposal phases: `commit` until `commit_ends_at`, then `reveal` until `reveal_ends_at`, then `finalized` with public tally.
  - Emit **`VoteCommitted`** (no `option_id`) and **`VoteRevealed`** (includes `option_id` for Aggregator tally).
  - Aggregator sets **`results_visible`** only after finalize; voter UI per **elixir_ui.mdc**.
  - Salt stored off-chain by voter; document missed-reveal policy (e.g. vote not counted).
- **Consequences:**
  - Two transactions per voter; UX and wallet guidance required.
  - Ingestion/Aggregator migrate from deprecated `VoteCast`.
  - Transparency: commitments and reveals are verifiable; enumeration of choices during commit phase is not suppressed from determined chain analysts.
- **Alternatives considered:** Public `VoteCast` with UI-only hiding (weak); encrypted on-chain ballots (out of scope).
- **References:** `architecture.mdc` §8, `event_schema.mdc` §5–7, `user_interface/elixir_ui.mdc`.
