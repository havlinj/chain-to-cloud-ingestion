# Planning (work in progress)

Short-lived notes that keep the team (and agents) aligned **before** or **during** implementation. Not a substitute for Accepted ADRs.

When direction is finalized:

1. Capture the decision in `docs/ADR/` (status **Accepted**), and/or
2. Update `.cursor/rules/development_plan.mdc` if the phased plan changes.

Then remove or archive planning notes that only duplicate the ADR.

## Active documents

| Document | Summary |
|----------|---------|
| [next_steps_cloud_integration.md](next_steps_cloud_integration.md) | **Next:** AWS devnet slice; then gRPC on Fargate (ADR 0005). CI Phase A done (Session 17) — see also [`docs/ci.md`](../ci.md). |
| [ci_cd_roadmap.md](ci_cd_roadmap.md) | ADR 0004 checklist — **Phase A done** (Session 17); Phase B after devnet slice. |
| [agreed_direction_skip_votecast.md](agreed_direction_skip_votecast.md) | Skip VoteCast placeholder contract; first on-chain model = commit–reveal; align Ingestion/Aggregator in one wave. |
| [deferred_dependency_audit_and_ci.md](deferred_dependency_audit_and_ci.md) | Audit/format CI scaffolding exists; full audit run and CI gates deferred until after devnet pipeline slice. |
