# Next steps — cloud integration roadmap

**Status:** WIP — agreed 2026-08-12; **updated after Session 17** to match remote CI platform + ADR 0005.  
**Supersedes:** informal chat only; does not replace `development_plan.mdc` phases.  
**Related:** [`docs/ci.md`](../ci.md) (CI how-to), ADR **0004**, ADR **0005**, `docs/setup_devnet_pipeline.md`, `docs/progress/session_17.md`

---

## Current baseline (after Session 17)

| Area | Status |
|------|--------|
| Smart contract (commit–reveal, eligibility) | Done — `anchor test` green locally |
| `tools/eligibility-admin`, `devnet-pipeline`, `voting-shared` | Done |
| Ingestion + Aggregator (commit/reveal, `results_visible`) | Done + local pipeline E2E tests |
| `infra/aws/` Terraform | Ready (SNS, SQS, DynamoDB, Lambdas, EventBridge) |
| **CI Phase A** | **Done** — `scripts/ci/` + `ci.yml` + `docs/ci.md` (Session 17); confirm green run on GitHub after push |
| **Live devnet → AWS → DynamoDB** | **Not verified** (Phase 3 step 7) — **next** |
| Aggregator gRPC read API | **Not implemented** — decision: ECS Fargate ([ADR 0005](../ADR/0005-aggregator-read-api-ecs-fargate.md)) |
| Eligibility audit projection | Not implemented |
| Forwarder / Analytics / UI | Not started — GCP infra skeleton only |

Local CI parity: `npm run ci` (see [`docs/ci.md`](../ci.md)).

---

## Agreed session order

### Session 17 — CI platform (done)

Delivered on remote + follow-ups: Phase A scripts, manifest, composite action, pre-commit, `docs/ci.md`. Recap: [`session_17.md`](../progress/session_17.md).

| # | Task | Status |
|---|------|--------|
| 17a | Phase A CI (`scripts/ci/`, `ci.yml`, toolchains) | Done |
| 17b–17e | AWS devnet slice | **Deferred to next session** (was originally bundled; CI landed first) |

---

### Next session — AWS devnet slice (Phase 3 step 7)

First real cloud integration. Runbook: [`setup_devnet_pipeline.md`](../setup_devnet_pipeline.md).

| # | Task | Cloud? | Notes |
|---|------|--------|-------|
| N1 | Fund devnet wallet, deploy program | Devnet | `smart-contract/scripts/deploy-devnet.sh` |
| N2 | `devnet-pipeline` bootstrap + lifecycle | Devnet | Save `proposal_id` |
| N3 | Package Lambdas, `terraform apply -var-file=dev.tfvars` | **AWS dev** | |
| N4 | Invoke ingestion, verify DynamoDB | **AWS dev** | `scripts/verify-dynamodb-projection.sh` |
| N5 | Record outcomes in `docs/progress/session_N.md` | — | Phase 3 step 7 checklist |

**Why AWS first:** All code and Terraform exist; proves chain → Ingestion → SNS → SQS → Aggregator → DynamoDB before GCP or UI.

**Do not start yet:** GCP `terraform apply`, Forwarder, BigQuery, UI.

---

### Following session — Aggregator gRPC read API (AWS)

| # | Task | Notes |
|---|------|-------|
| R1 | `.proto` — `ListProposals`, `GetProposal` | Same contract for Elixir UI later |
| R2 | `cmd/aggregator-api` — gRPC server, DynamoDB read-only | ADR 0005 |
| R3 | Enforce `results_visible` — hide `option_counts` until finalize | UI policy |
| R4 | Terraform — ECS Fargate + ALB | `infra/aws/` |
| R5 | Smoke test — `grpcurl` against deployed dev service | Closes Phase 1 read path gap |

Consumer Lambda (`cmd/aggregator`) stays SQS-only; no gRPC in the Lambda binary.

---

### Then — Self-audit + eligibility audit projection

| # | Task | Notes |
|---|------|-------|
| S1 | Self-audit workshop | `development_plan.mdc` Phase 3 step 9; contract feature freeze |
| S2 | Aggregator eligibility audit table + handlers | Append-only from eligibility events |
| S3 | CI Phase B (optional same session) | `anchor test`, `terraform plan` after step 7 green — see [`docs/ci.md`](../ci.md) |

---

### Later — Phase 2 cloud integration (GCP)

Only after AWS devnet slice **and** read API smoke test are green.

| Order | Component | Cloud | Depends on |
|-------|-----------|-------|------------|
| 1 | GCP Terraform — Pub/Sub, BigQuery | GCP dev | AWS event bus working |
| 2 | Forwarder Lambda | AWS → GCP | Forwarder SQS queue (already in AWS TF) |
| 3 | Analytics service (Cloud Run) | GCP dev | Pub/Sub + BigQuery |
| 4 | UI first slice (LiveView) | Local or Fly/Cloud Run | Aggregator gRPC on Fargate |

---

### Even later — Phase 4+

- OIDC deploy (ADR 0004 Phase C)
- Grafana cross-cloud dashboards
- Kafka / replay (optional ADR)
- UI streaming + Analytics gRPC
- Voting playground (Phase 5)

---

## Where to integrate with real cloud (summary)

| Priority | Environment | What | When |
|----------|-------------|------|------|
| **1** | AWS `dev` | Devnet pipeline slice | **Next** (after Session 17 CI) |
| **2** | AWS `dev` | gRPC read API on Fargate | After AWS slice |
| **3** | AWS `dev` + GCP `dev` | Forwarder → Pub/Sub | After 1–2 |
| **4** | GCP `dev` | Analytics → BigQuery | After Forwarder |
| **5** | Both | OIDC, Grafana, prod hardening | Phase 4 |

---

## Open gaps for Phase 3 exit (tracking)

- [x] CI Phase A (Session 17; confirm green on GitHub)
- [ ] Live devnet → AWS → DynamoDB (step 7)
- [ ] gRPC read API on Fargate (ADR 0005)
- [ ] Eligibility audit projection
- [ ] Self-audit workshop

---

## References

- CI how-to: [`docs/ci.md`](../ci.md)
- Runbook: [`setup_devnet_pipeline.md`](../setup_devnet_pipeline.md)
- CI checklist: [`ci_cd_roadmap.md`](ci_cd_roadmap.md)
- Read API decision: [`ADR/0005-aggregator-read-api-ecs-fargate.md`](../ADR/0005-aggregator-read-api-ecs-fargate.md)
- Phased plan: `.cursor/rules/development_plan.mdc`
