# ADR 0004: CI/CD with GitHub Actions

**Status:** Accepted  
**Date:** 2026-06-14  
**Deciders:** Project maintainers  
**Related:** `architecture.mdc` §6 (CI/CD), `development_plan.mdc` (CI/CD Roadmap), `docs/planning/ci_cd_roadmap.md`, `docs/planning/deferred_dependency_audit_and_ci.md`

---

## Context

The repository spans multiple languages and clouds:

- **Rust** — smart contract (`smart-contract/`), `voting-crypto` crate
- **TypeScript** — ingestion Lambda, eligibility admin, devnet tooling
- **Go** — aggregator (and later forwarder, analytics)
- **Terraform** — `infra/aws`, `infra/gcp`
- **Elixir** — user interface (Phase 5)

As of Session 16, CI coverage is **partial and inconsistent**:

| Asset | Current state | Gap |
|-------|---------------|-----|
| `.github/workflows/smart-contract.yml` | `voting-crypto` tests + host `cargo build` | No `anchor test`, no `cargo fmt`, no full workspace |
| `.github/workflows/terraform.yml` | `terraform fmt` + `validate` | Triggers on **`master` only**, not `main` |
| Ingestion / tools (TypeScript) | Local `npm test` only | No CI job |
| Aggregator (Go) | Local `go test` only | No CI job |
| Formatting | `scripts/format-all.sh` at repo root | Not wired into CI |
| Dependency audit | `scripts/audit-deps.sh` | Deferred (see planning note); not in CI |
| Deploy / E2E | Manual devnet runbook | No automated deploy or E2E in CI |

`architecture.mdc` requires GitHub Actions for lint, test, build, terraform plan/apply, and deploy, with **OIDC** preferred over static credentials. The project is not yet at deploy automation; this ADR defines a **phased** path that matches Phase 3 (devnet slice) and later phases.

**Problem:** Without a unified CI gate on every PR, regressions in ingestion, aggregator, formatting, or Terraform can merge unnoticed while only a narrow Rust subset is checked.

---

## Decision

Adopt a **single primary workflow** — `.github/workflows/ci.yml` — with **parallel jobs** and **path filters**, rolled out in three phases. Keep GitHub Actions as the sole CI platform (no additional CI vendor for this repo).

### Workflow design principles

1. **One workflow file** for day-to-day PR/push checks (`ci.yml`). Avoid proliferating per-service workflows unless a job has exceptional resource needs (e.g. long `anchor test` with Solana validator).
2. **Path filters** — jobs run only when relevant paths change (with a small shared core, e.g. format-check on broad paths or always on `main`).
3. **Fail fast, parallel** — independent jobs in parallel; no deploy steps in Phase A/B.
4. **Branch `main`** — all workflows trigger on `push` and `pull_request` to `main` (fix legacy `master` trigger).
5. **Local parity** — CI commands must match documented local scripts (`npm run format:check`, `go test`, `anchor test`, etc.).
6. **OIDC for deploy** — only in Phase C when infra apply and service deploy are automated; until then, CI is validate-only.

### Phase A — Baseline gate (implement in next session; priority)

**Goal:** Every PR to `main` gets lint/format/test coverage for code that exists today, without devnet secrets or cloud credentials.

| Job | Scope | Command / tool |
|-----|--------|----------------|
| `format-check` | Repo-wide | `npm ci` + `npm run format:check` (`scripts/format-all.sh --check`) |
| `typescript` | `services/ingestion/`, `tools/**` (TS packages) | `npm ci` + `npm test` / `npm run build` per package |
| `go-aggregator` | `services/aggregator/` | `go test ./...` |
| `rust-smart-contract` | `smart-contract/` | `cargo test` in `voting-crypto`; `cargo fmt --check` + `cargo clippy` (workspace policy as feasible) |
| `terraform` | `infra/aws/`, `infra/gcp/` | `terraform fmt -check` + `terraform init -backend=false` + `validate` per root module |

**Deliverables:**

- New `.github/workflows/ci.yml` with the jobs above.
- **Retire or fold** `smart-contract.yml` and `terraform.yml` into `ci.yml` (delete duplicates after parity confirmed).
- Document required checks in `docs/planning/ci_cd_roadmap.md` and `development_plan.mdc`.

**Explicitly not in Phase A:** `anchor test` (needs Solana/Anchor in runner), `terraform plan` (needs cloud creds), dependency audit, deploy, E2E.

### Phase B — After devnet E2E slice is green (Phase 3 step 7)

**Goal:** Strengthen gates once devnet pipeline is verified locally and runbook is stable.

| Addition | Rationale | When |
|----------|-----------|------|
| `anchor-test` job | Full program tests (46+ tests); catches IDL/constraint regressions | After Session 16+ devnet slice documented green |
| `terraform-plan` (read-only) | Catch plan drift before apply | When OIDC read roles exist or maintainers accept short-lived secrets in GitHub Environments |
| `audit-deps` job | `npm run audit` / `scripts/audit-deps.sh` | After baseline green; aligns with `deferred_dependency_audit_and_ci.md` **audit** half |
| Path filter tuning | Reduce noise as monorepo grows | Ongoing |

`anchor test` in CI typically uses `solana-install` + `avm` + `anchor test` with sufficient runner memory; document versions pinned to local dev (see `smart-contract/Anchor.toml`).

### Phase C — Phase 4+ (operational automation)

**Goal:** Match `architecture.mdc` deploy story; no static long-lived cloud keys in repo.

| Addition | When |
|----------|------|
| GitHub OIDC → AWS / GCP for `terraform apply` and service deploy | Phase 4 infra hardening |
| Ingestion / aggregator **build artifacts** in CI | Before production deploy pipeline |
| Forwarder + analytics jobs in `ci.yml` | When those services have tests |
| Elixir `mix test` / CI | Phase 5 UI |
| **E2E in CI** (devnet or LocalStack + mocked chain) | Phase 4–5; optional scheduled workflow, not every PR |
| Branch protection: require `ci.yml` checks | When Phase A stable on `main` |

---

## Consequences

### Positive

- Single place to see CI health; contributors know what runs on PR.
- Format drift caught before merge (`format-all.sh` already exists at repo root).
- Terraform and TypeScript/Go no longer “invisible” to automation.
- Phased rollout avoids blocking Phase 3 on OIDC or devnet wallet funding in CI.

### Negative / trade-offs

- `anchor test` in CI adds runner setup time and flakiness risk — deferred to Phase B intentionally.
- Path filters can miss cross-cutting breaks — mitigate with format-check and periodic full runs on `main`.
- Until branch protection is enabled, checks are advisory.

### Supersedes / merges

- Replaces the intent of standalone `smart-contract.yml` and `terraform.yml` once `ci.yml` is merged.
- **Does not** supersede `deferred_dependency_audit_and_ci.md` for **audit** timing; that doc is updated to state: **format/lint/test CI = Phase A (immediate); audit gates = Phase B**.

---

## Implementation checklist (next session)

Priority order for the implementing session:

1. [ ] Add `.github/workflows/ci.yml` (Phase A jobs).
2. [ ] Fix triggers: `main` not `master`.
3. [ ] Remove or disable redundant workflows after green run on a test PR.
4. [ ] Update `docs/planning/ci_cd_roadmap.md` status checkboxes.
5. [ ] Add `docs/progress/session_17.md` (or next session) with verification links.
6. [ ] (Optional) Enable GitHub branch protection requiring Phase A jobs.

---

## References

- `architecture.mdc` — §6 CI/CD, OIDC
- `development_plan.mdc` — CI/CD Roadmap section
- `docs/planning/ci_cd_roadmap.md` — detailed schedule
- `docs/planning/deferred_dependency_audit_and_ci.md` — audit vs format split
- `scripts/format-all.sh`, `package.json` (`format:check`)
- Existing workflows: `.github/workflows/smart-contract.yml`, `.github/workflows/terraform.yml`
