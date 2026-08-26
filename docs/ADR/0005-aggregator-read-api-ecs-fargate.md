# ADR 0005: Aggregator gRPC read API on ECS Fargate

**Status:** Accepted  
**Date:** 2026-08-12  
**Deciders:** Project maintainers  
**Related:** `architecture.mdc` §7 (Aggregator), `service_boundaries.mdc`, `development_plan.mdc` Phase 1, `docs/planning/next_steps_cloud_integration.md`

---

## Context

The Aggregator service has two distinct responsibilities:

1. **Event consumer** — consume SQS messages, apply idempotent projections, write DynamoDB (already implemented as an AWS Lambda).
2. **Read API** — expose gRPC queries (`ListProposals`, `GetProposal`, later streaming) for the user interface.

These workloads differ in runtime shape:

| Concern | SQS consumer (write path) | gRPC read API (read path) |
|---------|---------------------------|---------------------------|
| Trigger | SQS batch invocations | Long-lived TCP connections |
| Scaling | Event-driven, bursty | Steady or connection-based |
| Phase 4 | Unchanged | Server-streaming (`WatchProposals`, …) |

Options considered for the read API:

| Option | Pros | Cons |
|--------|------|------|
| **ECS Fargate service** (chosen) | Native long-lived gRPC; clean split from Lambda consumer; streaming-ready; standard ALB → target group pattern | More infra than a single Lambda |
| Lambda + API Gateway (gRPC) | Cheapest at very low traffic | Awkward gRPC on API GW; poor fit for streaming |
| Lambda Function URL + gRPC-Web proxy | Simple for dev spikes | Extra proxy hop; not ideal for production streaming |
| Combine read + write in one Lambda | Fewer moving parts | Mixes transport concerns; streaming and SQS in one binary is awkward |

The project already separates **operational projection (AWS)** from **analytics (GCP)**. The write path stays event-driven; the read path is a query surface for UI clients only — no synchronous calls between backend microservices.

---

## Decision

Deploy the Aggregator **gRPC read API as a separate ECS Fargate service** in AWS, distinct from the **SQS-triggered Aggregator Lambda** that maintains projections.

### Architecture

```
SQS (aggregator) ──► Aggregator Lambda ──► DynamoDB
                                              ▲
UI / grpcurl ──► ALB ──► ECS Fargate (read API) ──┘
                         (read-only DynamoDB access)
```

- **Two deployable artifacts** from `services/aggregator/` (or shared module, two entrypoints):
  - `cmd/aggregator/` — existing SQS Lambda (unchanged responsibility).
  - `cmd/aggregator-api/` (or equivalent) — gRPC server for read queries.
- **Shared:** domain types, DynamoDB repository read methods, `.proto` contract, config patterns.
- **Not shared at runtime:** the Lambda must not serve gRPC; the Fargate task must not consume SQS.
- **Exposure:** Application Load Balancer (or NLB if preferred later) in front of Fargate tasks; TLS at the load balancer for non-dev environments.
- **Phase 2 UI:** Elixir LiveView connects to the Fargate gRPC endpoint (or gRPC-Web gateway in front if browser constraints require it — separate spike, not part of this ADR).

### Terraform (when implemented)

Add to `infra/aws/` (module or inline):

- ECS cluster + Fargate service + task definition
- ALB, target group, listener (gRPC health checks where supported)
- IAM task role: DynamoDB **read** on `proposals`, `voter_activity` (and later eligibility audit table); **no** SQS permissions on the read task
- CloudWatch log group for the read service
- Security groups: ALB → tasks; tasks → DynamoDB via VPC endpoint or public AWS API per environment design

The existing Aggregator Lambda IAM remains write-oriented (SQS consume, DynamoDB read/write for projections, `processed_events`).

---

## Consequences

### Positive

- Clear **CQRS-style split** within Aggregator: Lambda = command/event side, Fargate = query side.
- **Streaming RPCs** (Phase 4) fit naturally on a long-lived server.
- Independent scaling and deploy: projection consumer can scale on queue depth; read API on request load.
- Aligns with `service_boundaries.mdc` — UI is a gRPC **client**, not part of the event bus.

### Negative / trade-offs

- Two binaries and two AWS compute resources to build, deploy, and monitor for one logical service.
- Requires VPC/network wiring (Fargate + optional VPC endpoints) beyond the current Lambda-only AWS stack.
- Dev environment cost is slightly higher than a single Lambda (acceptable for a portfolio/production-style demo).

### Follow-up work (not in this ADR)

1. Define `.proto` and generate Go server stubs.
2. Implement `cmd/aggregator-api` with `ListProposals`, `GetProposal` (unary only for Phase 1/2).
3. Terraform Fargate + ALB in `infra/aws/`.
4. Enforce `results_visible` in read responses (hide `option_counts` until finalize).
5. Phase 4: add server-streaming RPCs on the same Fargate service.

---

## Alternatives rejected

- **Single Lambda for both SQS and gRPC** — rejected: mixed lifecycle, poor streaming story.
- **API Gateway gRPC as primary read path** — rejected: workable for unary only; weak long-term fit for Watch/Stream RPCs.

---

## References

- `architecture.mdc` §7 — Aggregator gRPC read API
- `service_style.mdc` — API vs event consumer service types
- `docs/planning/next_steps_cloud_integration.md` — session order (read API after AWS devnet slice)
