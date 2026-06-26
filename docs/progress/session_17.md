# Session 17 — CI Phase A scripts, manifest, composite action, pre-commit, docs

## Context

Continue from Session 16 next step: **CI baseline (ADR 0004 Phase A)**. This session delivers runnable check scripts, GitHub workflow, toolchain manifest, composite action, pre-commit hooks, and durable CI documentation.

## Implementation Summary

### `scripts/ci/` (local + Actions parity)

- **`ci.sh`** — orchestrator (all checks or subset)
- **`format-check.sh`**, **`typescript.sh`**, **`go-aggregator.sh`**, **`rust-smart-contract.sh`**, **`terraform.sh`**
- **`common.sh`** — shared helpers + `load_manifest`
- **`manifest.env`** — pinned tool versions and `TS_PACKAGES` / `TF_STACKS` lists

Root `package.json`: `npm run ci`, `ci:format`, `ci:typescript`, etc.

### GitHub Actions

- **`.github/workflows/ci.yml`** — Phase A jobs with path filters; calls `scripts/ci/*.sh`
- **`.github/actions/ci-toolchains/`** — composite action; loads versions from `manifest.env`
- Removed legacy **`smart-contract.yml`**, **`terraform.yml`**

### Pre-commit

- **`.pre-commit-config.yaml`** — `scripts/format-all.sh --check` before commit (optional local install)

### Documentation

- **`docs/ci.md`** — architecture (3 layers), commands, phase mapping, **future improvements ladder**
- **`scripts/ci/README.md`** — quick pointer to `docs/ci.md`
- Updated **`docs/README.md`**, **`docs/planning/ci_cd_roadmap.md`**, root **`README.md`**

### Hygiene

- Prettier drift fixed (`npm run format`)
- `tools/eligibility-admin`, `tools/devnet-pipeline`: `vitest run --passWithNoTests`
- `services/ingestion/package-lock.json` synced

## Verification

```bash
npm ci && npm run format:check
SKIP_NPM_CI=1 npm run ci   # when package node_modules exist
pre-commit run --all-files # after: pip install pre-commit && pre-commit install
```

**Pending:** first green GitHub Actions run on `main` after push.

## Architectural Notes

- **Layer 1:** bash scripts (`what` to run)
- **Layer 2:** `manifest.env` + `ci-toolchains` composite (`which` tool versions)
- **Layer 3:** `ci.yml` (`when`, parallel jobs, caches)
- TypeScript matrix in YAML still lists packages explicitly; `manifest.env` is source of truth — dynamic matrix deferred (see `docs/ci.md`).

## Next Steps

1. Push / PR → confirm green CI on GitHub
2. Optional: branch protection requiring Phase A checks
3. Devnet E2E slice (Phase 3 step 7) per `docs/setup_devnet_pipeline.md`
4. Phase B CI when E2E green: `anchor-test`, audit, `terraform plan` — see `docs/ci.md` § Future improvements

## References

- `docs/ci.md`
- `docs/ADR/0004-ci-cd-github-actions.md`
- `docs/planning/ci_cd_roadmap.md`
- `docs/progress/session_16.md`
