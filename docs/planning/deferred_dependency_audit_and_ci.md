# Deferred: dependency audit triage (CI format/test is not deferred)

Status: **Accepted direction** — updated 2026-06-14 per **ADR 0004**.

## Context

Session 15 added repo-wide formatting (Prettier, gofmt, cargo fmt) and dependency **scan scripts** (`npm run audit`, `govulncheck`, `cargo audit`). Running a full audit now mostly surfaces **dev/test** advisories in the Anchor/Mocha/npm stacks, not blockers for the next milestone.

**ADR 0004** splits CI into phases:

- **Phase A (next session, priority):** `format-check`, TypeScript/Go/Rust tests, Terraform **validate** — **not deferred**.
- **Phase B (after devnet slice):** dependency **audit** jobs, `anchor test` in CI, Terraform **plan**.

The next engineering priority alongside CI Phase A remains **Phase 3 step 7**: devnet + AWS pipeline slice (chain → Ingestion → SNS/SQS → Aggregator).

## Decision

1. **Do not** treat `npm run audit` exit code 1 as a session blocker before the devnet slice.
2. **Do** implement Phase A CI gates per ADR 0004 in the **next session** (`ci.yml`, `npm run format:check`, service tests, Terraform validate on branch `main`).
3. **Do not** add **audit** CI jobs until after the devnet slice lands and lockfiles stabilize (Phase B).
4. **After** devnet slice: run `npm run audit`, triage dev-deps vs runtime, optionally `npm run audit:production` for Ingestion Lambda; install and run `govulncheck` / `cargo audit` once.
5. **Then** add audit jobs to `ci.yml` with an explicit policy (e.g. fail on high in production deps; allowlisted dev-deps or separate job).

## Tooling already available

| Command | When to use | CI phase |
|---------|-------------|----------|
| `npm run format:check` | Before PR | **Phase A** |
| `npm test` (ingestion, tools) | Before PR | **Phase A** |
| `go test ./...` (aggregator) | Before PR | **Phase A** |
| Terraform fmt + validate | Before PR | **Phase A** |
| `npm run audit` | After devnet slice + triage session | **Phase B** |
| `npm run audit:production` | Ingestion runtime deps before Lambda deploy | **Phase B** |
| `govulncheck ./...` | After `go install golang.org/x/vuln/cmd/govulncheck@latest` | **Phase B** |
| `cargo audit` | After `cargo install cargo-audit` | **Phase B** |
| `anchor test` | Local until Phase B | **Phase B** |

## References

- **ADR 0004** — `docs/ADR/0004-ci-cd-github-actions.md`
- `docs/planning/ci_cd_roadmap.md` — detailed job list and checklist
- `security_and_secrets.mdc` — dependency scanning expectation
- `docs/progress/session_15.md` — scaffolding added
- `.cursor/rules/development_plan.mdc` — CI/CD Roadmap; Phase 3 step 7 (devnet slice) and step 10 (CI baseline)
