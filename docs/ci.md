# CI and local checks

How continuous integration works in this repository: what runs where, how to reproduce it locally, and optional improvements to adopt as the project grows.

**Authoritative decision:** [ADR 0004](ADR/0004-ci-cd-github-actions.md) (phased GitHub Actions).  
**Implementation checklist:** [planning/ci_cd_roadmap.md](planning/ci_cd_roadmap.md) (WIP tasks).  
**This document:** durable reference — architecture, commands, and a **future improvements ladder** tied to project phases.

---

## Design principle: three layers

```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — WHEN / HOW MANY (GitHub Actions)                 │
│  Path filters, matrix, caches, concurrency                  │
│  File: .github/workflows/ci.yml                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — TOOLCHAIN (versions + setup)                     │
│  Node, Go, Rust, Terraform pins                             │
│  Files: scripts/ci/manifest.env, .github/actions/ci-toolchains │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — WHAT TO RUN (bash scripts)                       │
│  Tests, format check, terraform validate                    │
│  Files: scripts/ci/*.sh                                       │
└─────────────────────────────────────────────────────────────┘
```

**Rule:** YAML does not embed test commands. It prepares the runner and calls `scripts/ci/*.sh`. The same scripts run locally via `npm run ci`.

---

## Components

| Piece | Role |
|-------|------|
| [`scripts/ci/manifest.env`](../scripts/ci/manifest.env) | Single source of truth for tool versions and package/stack lists |
| [`scripts/ci/ci.sh`](../scripts/ci/ci.sh) | Local orchestrator — runs all or selected checks |
| [`scripts/ci/*.sh`](../scripts/ci/) | One script per check domain (format, TypeScript, Go, Rust, Terraform) |
| [`.github/actions/ci-toolchains/`](../.github/actions/ci-toolchains/action.yml) | Composite action — installs toolchains from `manifest.env` |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | PR/push workflow — path filters, parallel jobs, calls scripts |
| [`tools/voting-shared/`](../tools/voting-shared/) | Shared TS library — builds to `dist/`; CI builds it before dependent tool packages |
| [`.pre-commit-config.yaml`](../.pre-commit-config.yaml) | Optional hook — format check before each commit |
| [`scripts/format-all.sh`](../scripts/format-all.sh) | Format write/check (used by pre-commit and `format-check` job) |

### Manifest (`manifest.env`)

Holds pinned versions and lists:

- `NODE_VERSION`, `GO_VERSION`, `RUST_TOOLCHAIN`, `TERRAFORM_VERSION`
- `TS_PACKAGES` — space-separated TypeScript package paths
- `TF_STACKS` — space-separated Terraform roots (`aws`, `gcp`)

**Consumed by:** bash scripts (via `load_manifest` in `common.sh`) and the composite action (sourced at runtime in CI).

**Manual sync:** The TypeScript matrix in `ci.yml` must still list the same packages as `TS_PACKAGES` until [dynamic matrix](#improvement-dynamic-matrix) is adopted. A comment in the workflow points here.

### Composite action (`ci-toolchains`)

A **reusable setup block** inside the repo. Jobs pass a `profile`:

| Profile | Installs |
|---------|----------|
| `node` | Node.js (+ npm cache) |
| `go` | Go |
| `rust` | Rust + rustfmt |
| `terraform` | Terraform |
| `all` | All of the above (used by `format-check`) |

Versions always come from `manifest.env` — not hardcoded in the action file.

### Pre-commit

Runs `scripts/format-all.sh --check` before each commit (if hooks are installed).

- **Stricter than local dev convenience:** `format-all.sh` skips missing tools (e.g. no Terraform installed).
- **Lighter than CI `format-check.sh`:** CI requires all tools and fails if any are absent.
- **Does not replace GitHub CI** — it catches format drift early on your machine.

Install once per clone:

```bash
pip install pre-commit   # or: brew install pre-commit
pre-commit install
```

Run manually on all files:

```bash
pre-commit run --all-files
```

---

## Phase A checks (current)

| Check | Local | GitHub job | Script |
|-------|-------|------------|--------|
| Format | `npm run ci:format` | `format-check` | `scripts/ci/format-check.sh` |
| TypeScript | `npm run ci:typescript` | `typescript` (matrix) | `scripts/ci/typescript.sh` |
| Go aggregator | `npm run ci:go` | `go-aggregator` | `scripts/ci/go-aggregator.sh` |
| Rust smart contract | `npm run ci:rust` | `rust-smart-contract` | `scripts/ci/rust-smart-contract.sh` (`fmt`, `clippy -p voting-crypto -- -D warnings`, tests, host `cargo build -p voting`) |
| Terraform | `npm run ci:terraform` | `terraform` (matrix) | `scripts/ci/terraform.sh` |
| **All** | `npm run ci` | all applicable jobs | `scripts/ci/ci.sh` |

**Rust note:** Clippy runs on `voting-crypto` only (not the full `voting` program host build). The `ci-toolchains` rust profile installs `rustfmt` and `clippy`.

**Not in Phase A:** `anchor test`, dependency audit, `terraform plan`, deploy, E2E (see phases below).

### Prerequisites (local full parity)

| Tool | Version (see manifest) | Install |
|------|------------------------|---------|
| Node.js | 20 | [nodejs.org](https://nodejs.org) |
| Go | 1.22 | [go.dev](https://go.dev/dl/) |
| Rust | 1.85 | [rustup.rs](https://rustup.rs) |
| Terraform | 1.10 | [HashiCorp](https://developer.hashicorp.com/terraform/downloads) |

### Common commands

```bash
# From repo root
npm ci && npm run ci              # full Phase A (installs root Prettier)

SKIP_NPM_CI=1 npm run ci          # skip npm ci when deps already installed

# Subset
scripts/ci/ci.sh format-check go-aggregator
scripts/ci/typescript.sh services/ingestion
```

---

## What runs on a pull request

1. **`changes` job** — `dorny/paths-filter` decides which downstream jobs are needed.
2. **Parallel jobs** — only triggered checks run; others are skipped.

Examples:

| Files changed | Typical jobs |
|---------------|--------------|
| `services/aggregator/**` | `format-check`, `go-aggregator` |
| `tools/voting-shared/**` | `format-check`, `typescript` (voting-shared matrix cell) |
| `docs/**` only | `format-check` only |
| `infra/aws/**` | `format-check`, `terraform` (aws) |

`format-check` uses a broad filter (`**`) and runs on almost every PR.

---

## Mapping to project phases

Aligned with `.cursor/rules/development_plan.mdc` and ADR 0004.

| Project phase | CI milestone | Status |
|---------------|--------------|--------|
| Phase 3 step 10 | **Phase A** — `ci.yml`, `scripts/ci/`, manifest, composite action, pre-commit | **Current** |
| Phase 3 step 7 green | **Phase B** — `anchor test`, audit jobs, `terraform plan` | Planned |
| Phase 2 services land | Add Forwarder / Analytics / UI jobs to `ci.yml` | Planned |
| Phase 4+ | **Phase C** — OIDC deploy, reusable workflow, E2E in CI | Planned |

When a milestone is reached, update the **Status** column here and check off items in [ci_cd_roadmap.md](planning/ci_cd_roadmap.md).

---

## Future improvements ladder

Optional upgrades — adopt when the trigger applies. Do not implement all at once.

### Improvement: dynamic matrix

| | |
|---|---|
| **What** | Job reads `TS_PACKAGES` from `manifest.env` and generates the TypeScript matrix via `fromJson` |
| **Principle** | Configuration drives orchestration — add a package in one place |
| **Affects** | Layer 3 (YAML only); local `npm run ci` unchanged |
| **Complexity** | Medium |
| **Adopt when** | TS package count grows or sync drift becomes annoying |
| **Phase** | Any time after Phase A is stable |

### Improvement: `act` (local GitHub Actions)

| | |
|---|---|
| **What** | CLI to run `ci.yml` in Docker locally |
| **Principle** | Debug workflow structure without pushing |
| **Affects** | Local dev only; GitHub unchanged |
| **Complexity** | Medium |
| **Adopt when** | Frequently changing `ci.yml` / path filters |
| **Phase** | Optional anytime |

### Improvement: branch protection

| | |
|---|---|
| **What** | Require Phase A checks before merge to `main` |
| **Principle** | CI becomes blocking, not advisory |
| **Affects** | GitHub repo settings |
| **Complexity** | Low |
| **Adopt when** | First green CI run on `main` is confirmed |
| **Phase** | End of Phase A (ADR 0004 checklist) |

### Improvement: `scripts/ci/anchor-test.sh` + CI job

| | |
|---|---|
| **What** | `anchor test` in GitHub (Solana + Anchor on runner) |
| **Principle** | Same script pattern as `rust-smart-contract.sh` |
| **Affects** | New job in `ci.yml`; longer CI runs |
| **Complexity** | Medium–high (runner RAM, version pins) |
| **Adopt when** | Devnet E2E slice is green ([setup_devnet_pipeline.md](setup_devnet_pipeline.md)) |
| **Phase** | **Phase B** (ADR 0004) |

### Improvement: dependency audit job

| | |
|---|---|
| **What** | `npm run audit`, govulncheck, cargo audit in CI |
| **Principle** | Supply-chain visibility |
| **Affects** | New job; may need triage policy |
| **Complexity** | Medium |
| **Adopt when** | Phase B; see [deferred_dependency_audit_and_ci.md](planning/deferred_dependency_audit_and_ci.md) |
| **Phase** | **Phase B** |

### Improvement: `terraform plan` (read-only)

| | |
|---|---|
| **What** | Plan against AWS/GCP without apply |
| **Principle** | Catch IaC drift before merge |
| **Affects** | Needs OIDC or scoped cloud credentials |
| **Complexity** | Medium–high |
| **Adopt when** | OIDC read roles exist |
| **Phase** | **Phase B** → hardening in **Phase C** |

### Improvement: reusable workflow (`workflow_call`)

| | |
|---|---|
| **What** | `_ci-checks.yml` invoked from deploy workflow |
| **Principle** | Deploy pipeline reuses the same scripts/checks as PR CI |
| **Affects** | New workflow file; deploy runs checks before apply |
| **Complexity** | Medium |
| **Adopt when** | Automated `terraform apply` / service deploy (OIDC) |
| **Phase** | **Phase C** (ADR 0004) |

### Improvement: npm workspaces + Turborepo

| | |
|---|---|
| **What** | Single root `npm ci`; `turbo run test typecheck` across packages |
| **Principle** | Monorepo dependency graph + cache |
| **Affects** | Layer 1 + 3; restructure `package.json` layout |
| **Complexity** | High |
| **Adopt when** | Phase 2+ adds more TypeScript services (Forwarder, tooling) |
| **Phase** | **Phase 2** or later |

### Improvement: devcontainer / Nix

| | |
|---|---|
| **What** | Reproducible dev environment as code |
| **Principle** | Same toolchain on every machine and optionally in CI |
| **Affects** | `.devcontainer/` or `flake.nix`; optional CI integration |
| **Complexity** | High |
| **Adopt when** | Multiple contributors or frequent toolchain mismatch |
| **Phase** | Optional; not required for portfolio scope |

### Improvement: E2E workflow

| | |
|---|---|
| **What** | Scheduled or manual devnet / pipeline smoke test in CI |
| **Principle** | Prove wiring end-to-end automatically |
| **Affects** | Secrets (devnet wallet, AWS); separate workflow from PR `ci.yml` |
| **Complexity** | High |
| **Adopt when** | E2E tests exist per `testing_e2e.mdc` |
| **Phase** | **Phase 4–5** |

---

## Adding a new TypeScript package

1. Add path to `TS_PACKAGES` in `scripts/ci/manifest.env`.
2. Add the same path to the `matrix.package` list in `.github/workflows/ci.yml`.
3. Ensure the package has `package-lock.json`, `npm test`, and `npm run typecheck`.
4. If the package depends on `voting-shared` via `file:../voting-shared`, extend `scripts/ci/typescript.sh` so the job builds `tools/voting-shared` (`npm ci` + `npm run build` → `dist/`) before the dependent package. Consumers resolve compiled JS + `.d.ts`, not `src/`.
5. Run `npm run ci:typescript` locally.

---

## References

- [ADR 0004 — CI/CD with GitHub Actions](ADR/0004-ci-cd-github-actions.md)
- [CI/CD roadmap (WIP checklist)](planning/ci_cd_roadmap.md)
- [Deferred dependency audit](planning/deferred_dependency_audit_and_ci.md)
- [Development plan — CI/CD Roadmap](../.cursor/rules/development_plan.mdc)
- [scripts/ci/README.md](../scripts/ci/README.md) — quick pointer to this doc
