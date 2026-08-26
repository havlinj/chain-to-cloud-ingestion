# Next steps — cloud integration roadmap

**Status:** WIP — agreed in planning discussion (2026-08-12).  
**Supersedes:** informal chat only; does not replace `development_plan.mdc` phases.  
**Related:** `docs/progress/session_16.md`, ADR **0004** (CI), ADR **0005** (read API on Fargate), `docs/setup_devnet_pipeline.md`

---

## Current baseline (after Session 16)

| Area | Status |
|------|--------|
| Smart contract (commit–reveal, eligibility) | Done — `anchor test` green |
| `tools/eligibility-admin`, `devnet-pipeline`, `voting-shared` | Done |
| Ingestion + Aggregator (commit/reveal, `results_visible`) | Done + local pipeline E2E tests |
| `infra/aws/` Terraform | Ready (SNS, SQS, DynamoDB, Lambdas, EventBridge) |
| **Live devnet → AWS → DynamoDB** | **Not verified** (Phase 3 step 7) |
| CI Phase A (`ci.yml`) | Planned — not implemented |
| Aggregator gRPC read API | **Not implemented** — decision: ECS Fargate (ADR 0005) |
| Eligibility audit projection | Not implemented |
| Forwarder / Analytics / UI | Not started — GCP infra skeleton only |

---

## Agreed session order

### Session 17 — CI baseline + AWS devnet slice (parallel OK)

| # | Task | Cloud? | Notes |
|---|------|--------|-------|
| 17a | Implement `.github/workflows/ci.yml` Phase A | No | Per `docs/planning/ci_cd_roadmap.md` A1–A8 |
| 17b | Fund devnet wallet, deploy program | Devnet only | `smart-contract/scripts/deploy-devnet.sh` |
| 17c | `devnet-pipeline lifecycle` | Devnet only | Save `proposal_id` |
| 17d | Package Lambdas, `terraform apply -var-file=dev.tfvars` | **AWS dev** | First real cloud integration |
| 17e | Invoke ingestion, verify DynamoDB | **AWS dev** | `scripts/verify-dynamodb-projection.sh` |
| 17f | Record in `docs/progress/session_17.md` | — | Exit criteria: Phase 3 step 7 checklist |

**Why AWS first:** All code and Terraform exist; devnet is free; proves chain → Ingestion → SNS → SQS → Aggregator → DynamoDB before adding GCP or UI.

**Do not start yet:** GCP `terraform apply`, Forwarder, BigQuery, UI.

---

### Session 18 — Aggregator gRPC read API (AWS)

| # | Task | Notes |
|---|------|-------|
| 18a | `.proto` — `ListProposals`, `GetProposal` | Same contract for Elixir UI later |
| 18b | `cmd/aggregator-api` — gRPC server, DynamoDB read-only | ADR 0005 |
| 18c | Enforce `results_visible` — hide `option_counts` until finalize | UI policy |
| 18d | Terraform — ECS Fargate + ALB | `infra/aws/` |
| 18e | Smoke test — `grpcurl` against deployed dev service | Closes Phase 1 read path gap |

Consumer Lambda (`cmd/aggregator`) stays SQS-only; no gRPC in the Lambda binary.

---

### Session 19 — Self-audit + eligibility audit projection

| # | Task | Notes |
|---|------|-------|
| 19a | Self-audit workshop | `development_plan.mdc` Phase 3 step 9; contract feature freeze |
| 19b | Aggregator eligibility audit table + handlers | Append-only from eligibility events |
| 19c | CI Phase B (optional same session) | `anchor test`, `terraform plan` after step 7 green |

---

### Later — Phase 2 cloud integration (GCP)

Only after AWS devnet slice **and** read API smoke test are green.

| Order | Component | Cloud | Depends on |
|-------|-----------|-------|------------|
| 1 | GCP Terraform — Pub/Sub, BigQuery | GCP dev | AWS event bus working |
| 2 | Forwarder Lambda | AWS → GCP | Forwarder SQS queue (already in AWS TF) |
| 3 | Analytics service (Cloud Run) | GCP dev | Pub/Sub + BigQuery |
| 4 | UI first slice (LiveView) | Local or Fly/Cloud Run | Aggregator gRPC on Fargate (session 18) |

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
| **1** | AWS `dev` | Devnet pipeline slice | Session 17 |
| **2** | AWS `dev` | gRPC read API on Fargate | Session 18 |
| **3** | AWS `dev` + GCP `dev` | Forwarder → Pub/Sub | After 1–2 |
| **4** | GCP `dev` | Analytics → BigQuery | After Forwarder |
| **5** | Both | OIDC, Grafana, prod hardening | Phase 4 |

---

## Open gaps for Phase 3 exit (tracking)

- [ ] Live devnet → AWS → DynamoDB (step 7)
- [ ] CI Phase A
- [ ] gRPC read API on Fargate (ADR 0005)
- [ ] Eligibility audit projection
- [ ] Self-audit workshop

---

## References

- Runbook: `docs/setup_devnet_pipeline.md`
- CI checklist: `docs/planning/ci_cd_roadmap.md`
- Read API decision: `docs/ADR/0005-aggregator-read-api-ecs-fargate.md`
- Phased plan: `.cursor/rules/development_plan.mdc`
