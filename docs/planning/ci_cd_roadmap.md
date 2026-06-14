# CI/CD roadmap (working plan)

**Status:** WIP — implementation tracked under **ADR 0004** (Accepted).  
**Next session priority:** implement **Phase A** in `.github/workflows/ci.yml`.

Authoritative schedule also lives in `.cursor/rules/development_plan.mdc` (section **CI/CD Roadmap**).

---

## Current baseline (Session 16)

| Check | Local | CI |
|-------|-------|-----|
| `format-all.sh --check` | `npm run format:check` | ❌ |
| Ingestion tests | `services/ingestion` npm test | ❌ |
| Eligibility admin / devnet tools | per-package npm test | ❌ |
| Aggregator | `go test ./...` | ❌ |
| `voting-crypto` | `cargo test` | ✅ `smart-contract.yml` |
| Smart contract fmt/clippy | manual | ❌ |
| `anchor test` | local | ❌ |
| Terraform fmt/validate | manual | ⚠️ `terraform.yml` on **`master` only** |
| Dependency audit | `npm run audit` | ❌ deferred |
| Deploy / E2E | `docs/setup_devnet_pipeline.md` | ❌ |

---

## Phase A — Do immediately (next session)

**ADR:** [0004-ci-cd-github-actions.md](../ADR/0004-ci-cd-github-actions.md) § Phase A.

| # | Task | Owner / notes |
|---|------|----------------|
| A1 | Create `.github/workflows/ci.yml` with parallel jobs | Next session **#1 priority** |
| A2 | Job `format-check`: `npm ci` + `npm run format:check` | Uses existing `scripts/format-all.sh` |
| A3 | Job `typescript`: ingestion + tools TS packages | Path filter `services/ingestion/**`, `tools/**` |
| A4 | Job `go-aggregator`: `go test ./...` | Path filter `services/aggregator/**` |
| A5 | Job `rust-smart-contract`: fmt check + `voting-crypto` tests | Fold `smart-contract.yml` |
| A6 | Job `terraform`: fmt + validate both roots | Fold `terraform.yml`; trigger **`main`** |
| A7 | Delete redundant workflows after first green CI run | Avoid duplicate minutes |
| A8 | Session progress doc + link PR | `docs/progress/session_17.md` |

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
# From repo root
npm ci && npm run format:check

cd services/ingestion && npm ci && npm test
cd services/aggregator && go test ./...
cd smart-contract/voting-crypto && cargo test

terraform -chdir=infra/aws fmt -check -recursive
terraform -chdir=infra/aws init -backend=false && terraform -chdir=infra/aws validate
terraform -chdir=infra/gcp fmt -check -recursive
terraform -chdir=infra/gcp init -backend=false && terraform -chdir=infra/gcp validate
```

`anchor test` — Phase B only; run locally from `smart-contract/` until CI job exists.
