# CI/CD roadmap (working plan)

**Status:** WIP — Phase A implemented. See **[`docs/ci.md`](../ci.md)** for architecture and future improvements.  
**Next:** green CI run on `main`; branch protection; devnet E2E slice (Phase 3 step 7).

Authoritative schedule: `.cursor/rules/development_plan.mdc` (CI/CD Roadmap). Improvement ideas by phase: [`docs/ci.md`](../ci.md) § Future improvements ladder.

---

## Current baseline (Session 17)

| Check | Local | CI |
|-------|-------|-----|
| All Phase A checks | `npm run ci` / `scripts/ci/ci.sh` | ✅ `ci.yml` |
| `format-check` | `scripts/ci/format-check.sh` | ✅ |
| TypeScript packages | `scripts/ci/typescript.sh` | ✅ (matrix) |
| Aggregator | `scripts/ci/go-aggregator.sh` | ✅ |
| `voting-crypto` + fmt + clippy + host build | `scripts/ci/rust-smart-contract.sh` | ✅ |
| Terraform fmt/validate | `scripts/ci/terraform.sh` | ✅ (`main`) |
| `anchor test` | `smart-contract/scripts/run-all-tests.sh` | ❌ Phase B |
| Dependency audit | `npm run audit` | ❌ Phase B |
| Pre-commit (format) | `pre-commit run --all-files` | optional (local) |
| Deploy / E2E | `docs/setup_devnet_pipeline.md` | ❌ |

Manifest + composite action: [`scripts/ci/manifest.env`](../../scripts/ci/manifest.env), [`.github/actions/ci-toolchains`](../../.github/actions/ci-toolchains/action.yml).

## Phase A — baseline gate

**ADR:** [0004-ci-cd-github-actions.md](../ADR/0004-ci-cd-github-actions.md) § Phase A.  
**Docs:** [`docs/ci.md`](../ci.md).

| # | Task | Status |
|---|------|--------|
| A1 | `.github/workflows/ci.yml` with parallel jobs | done |
| A2 | `format-check` via `scripts/ci/format-check.sh` | done |
| A3 | `typescript` — ingestion + tools | done |
| A4 | `go-aggregator` | done |
| A5 | `rust-smart-contract` | done |
| A6 | `terraform` (aws + gcp) on `main` | done |
| A7 | Retire `smart-contract.yml`, `terraform.yml` | done |
| A8 | `docs/ci.md` + session progress | done |
| A9 | `manifest.env` + composite `ci-toolchains` | done |
| A10 | pre-commit (format) | done |
| — | First green CI on `main` | pending |
| — | Branch protection (optional) | pending |

**Exit criteria:** A PR touching ingestion, aggregator, smart-contract, or infra gets the matching jobs; all Phase A jobs pass on `main`.

---

## Phase B — After devnet E2E slice green (Phase 3 step 7)

**When:** Devnet pipeline verified per `docs/setup_devnet_pipeline.md` and Phase 3 step 7 checklist — not before anchor CI is worth the runner cost.

| # | Task | Notes |
|---|------|-------|
| B1 | `anchor-test` job in CI | Pin Solana/Anchor versions; sufficient RAM |
| B2 | `audit-deps` job | See `deferred_dependency_audit_and_ci.md` |
| B3 | `terraform-plan` (read-only) | Needs OIDC or scoped secrets |
| B4 | Tune path filters from first month of PR noise | |

---

## Phase C — Phase 4+ (later)

| # | Task | When |
|---|------|------|
| C1 | GitHub OIDC → AWS/GCP | Phase 4 deploy automation |
| C2 | `terraform apply` + service deploy workflows | Separate from PR `ci.yml` |
| C3 | Forwarder + analytics CI jobs | When services have tests |
| C4 | Elixir `mix test` in CI | Phase 5 UI |
| C5 | E2E workflow (scheduled or manual dispatch) | Phase 4–5; not every PR |
| C6 | Branch protection required checks | After Phase A stable |

---

## Relationship to other planning docs

- **`deferred_dependency_audit_and_ci.md`** — **Audit** remains Phase B; **format/lint/test CI** is Phase A (no longer deferred).
- **`agreed_direction_skip_votecast.md`** — unrelated to CI; ingestion event types already migrated in code paths under test in Phase A.

---

## Verification commands (local parity)

```bash
# From repo root — same checks as .github/workflows/ci.yml
npm ci && npm run ci

# Or run individual steps:
bash scripts/ci/format-check.sh
bash scripts/ci/typescript.sh
bash scripts/ci/go-aggregator.sh
bash scripts/ci/rust-smart-contract.sh
bash scripts/ci/terraform.sh

# Skip npm ci when deps are already installed:
SKIP_NPM_CI=1 npm run ci
```

`anchor test` — Phase B only; run locally from `smart-contract/` until CI job exists.
