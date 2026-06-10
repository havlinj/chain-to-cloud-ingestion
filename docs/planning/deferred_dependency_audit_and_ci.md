# Deferred: dependency audit triage and CI gates

Status: **Accepted direction** — tooling is in place; **execution** waits until after the devnet pipeline slice.

## Context

Session 15 added repo-wide formatting (Prettier, gofmt, cargo fmt) and dependency **scan scripts** (`npm run audit`, `govulncheck`, `cargo audit`). Running a full audit now mostly surfaces **dev/test** advisories in the Anchor/Mocha/npm stacks, not blockers for the next milestone.

The next priority is **Phase 3 step 7**: devnet + AWS pipeline slice (chain → Ingestion → SNS/SQS → Aggregator).

## Decision

1. **Do not** treat `npm run audit` exit code 1 as a session blocker before the devnet slice.
2. **Do not** add CI audit/format gates until after the slice lands and lockfiles stabilize.
3. **After** devnet slice: run `npm run audit`, triage dev-deps vs runtime, optionally `npm run audit:production` for Ingestion Lambda; install and run `govulncheck` / `cargo audit` once.
4. **Then** add CI jobs with an explicit policy (e.g. fail on high in production deps; allowlisted dev-deps or separate job).

## Tooling already available

| Command | When to use |
|---------|-------------|
| `npm run format:check` | Before PR; candidate for early CI |
| `npm run audit` | After devnet slice + triage session |
| `npm run audit:production` | Ingestion runtime deps before Lambda deploy |
| `govulncheck ./...` | After `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| `cargo audit` | After `cargo install cargo-audit` |

## References

- `security_and_secrets.mdc` — dependency scanning expectation
- `docs/progress/session_15.md` — scaffolding added
- `.cursor/rules/development_plan.mdc` Phase 3 step 7 (devnet slice)
