# Chain-to-Cloud Ingestion

## Purpose and Scope

This is an **exploratory, experimental, learning-focused project**. The goal is to combine a chosen set of technologies and apply them in a single use case that is rigorous enough to stand as a real system—using solid development practices, clear boundaries, and production-style operational thinking. The project is explicitly designed to train exposure to and practice with the following:

- **Agentic AI development workflow** — Cursor-driven, approval-based iteration; rules in `.cursor/rules/` steer the AI agent toward small steps, explicit confirmation, and documented progress.
- **Cloud services** — **AWS** (operational path: Lambda, SQS, SNS, DynamoDB, API Gateway, CloudWatch) and **GCP** (analytics path: Pub/Sub, Cloud Run, BigQuery, Cloud Monitoring).
- **Infrastructure as Code** — **Terraform** for all infrastructure (`infra/aws`, `infra/gcp`); environment separation, least-privilege IAM, and OIDC-based CI/CD where applicable.
- **Microservices** — Bounded services (Ingestion, Aggregator, Forwarder, Analytics, plus smart contract and UI) with strict ownership of data and no synchronous cross-service RPC.
- **Event-driven architecture** — Blockchain as immutable event source; all downstream processing via events only; at-least-once delivery and idempotent consumers.
- **Solana blockchain integration** — Voting logic implemented as a **Solana program** (Rust, Anchor); contract emits structured events (ProposalCreated, VoteCast, ProposalClosed) consumed off-chain.
- **Messaging middleware** — AWS SQS/SNS for MVP fan-out; **Kafka** is an optional Phase 3 evolution for replay, consumer lag, and stronger log semantics.
- **System observability** — **Grafana** for cross-cloud dashboards; datasources include CloudWatch, GCP Monitoring, and BigQuery; structured logs and correlation fields for traceability.
- **Go** — Primary language for Aggregator and Analytics services; clean layering (handlers, service, domain, repository), idiomatic Go, and strict idempotency in event handlers.
- **Elixir UI** — **Phoenix LiveView** application in `user_interface/` acting as a client of the backend; consumes **gRPC** read/streaming APIs from Aggregator (and optionally Analytics); no participation in the event bus.
- **gRPC API** — Read and query APIs exposed by the Go services (e.g. ListProposals, GetProposal, WatchProposals, StreamProposalVotes, GetVoterActivity, and analytics trends); contract for the Governance & Voting UI; exposed via API Gateway or gRPC-Web proxy as needed.

All of the above were intentionally brought into the project to practice them in a coherent, senior-level architecture.

---

## One-Sentence Overview

A **multi-cloud, event-driven system** in which a blockchain voting smart contract emits events that are ingested into AWS serverless infrastructure, distributed through an event bus, and processed by independent microservices across AWS and GCP using a **CQRS** architecture.

---

## Goals

The project is designed to demonstrate **senior-level cloud architecture skills**:

- **Blockchain as immutable event source** — On-chain state changes become the single source of truth; off-chain systems react via events only.
- **Event-driven design** — Decoupling, resilience, scalability, and (with Kafka) replayability.
- **Microservices with clear boundaries** — Each service has defined responsibilities and its own data store; no cross-service DB access or synchronous RPC.
- **Multi-cloud** — AWS for operational workloads (ingestion, aggregation, DynamoDB); GCP for analytics (BigQuery, derived tables). Forwarder bridges events from AWS to GCP.
- **Observability-first** — Structured logging, correlation IDs, metrics, and Grafana dashboards.
- **Infrastructure as Code** — Terraform, GitHub Actions, and production-style operational mindset.

The system is intended to feel like a **realistic cloud-native system**, not a toy demo.

---

## High-Level Architecture

**Mental model:** *Blockchain → Event stream → Projections.*

1. **Smart contract** (Solana, Rust/Anchor) — Manages proposals and votes; emits `ProposalCreated`, `VoteCast`, `ProposalClosed`.
2. **Ingestion** (AWS Lambda) — Connects to chain RPC/WebSocket, normalizes events, publishes to the event bus. No business logic; strictly an adapter from blockchain to bus.
3. **Event bus (fan-out)** — One SNS topic (or two SQS queues) so that **Aggregator** and **Forwarder** both receive every event.
4. **Aggregator** (Go, AWS) — Consumes from SQS, maintains the **operational projection** in DynamoDB (proposals, vote counts, voter activity). Exposes **gRPC read API** for the UI.
5. **Forwarder** (AWS Lambda) — Consumes from SQS, forwards events to **GCP Pub/Sub**. Stateless bridge only.
6. **Analytics** (Go, GCP Cloud Run) — Consumes from Pub/Sub, writes raw events to BigQuery, builds analytical tables; optionally exposes gRPC query API for trends.
7. **User interface** — Elixir/Phoenix LiveView app that calls Aggregator (and optionally Analytics) via gRPC only; no direct event bus access.

**Data ownership:** Aggregator owns DynamoDB; Analytics owns BigQuery. No service reads or writes another service’s store. Communication is **event-only**; the UI is a gRPC client.

**Idempotency:** Delivery is at-least-once (SQS, Pub/Sub). Every event consumer must be idempotent (e.g. event_id deduplication, upserts).

---

## Repository Structure

```
smart-contract/          # Solana program (Rust/Anchor)
services/
  ingestion/             # AWS Lambda — chain → event bus
  aggregator/            # Go — SQS → DynamoDB, gRPC API
  forwarder/             # AWS Lambda — SQS → Pub/Sub
  analytics/             # Go, GCP — Pub/Sub → BigQuery, optional gRPC
user_interface/          # Elixir/Phoenix LiveView — gRPC client
tools/                   # Phase 4: primitive voting UI, simulation/orchestration
infra/
  aws/
  gcp/
grafana/
  dashboards/
docs/
  ADR/
  diagrams/
  progress/
.github/workflows/
.cursor/rules/           # Architecture, boundaries, style, testing, agent workflow
```

---

## Event Schema

Events use a **canonical envelope**: `event_id`, `event_type`, `timestamp`, `source`, `version`. Payloads are JSON. Solana uses **slot** (not block number). Schema evolution is backward-compatible only (add fields, never remove or change meaning). See `.cursor/rules/event_schema.mdc` and `architecture.mdc` §9 for full details.

---

## Technology Summary

| Area            | Choice |
|----------------|--------|
| Blockchain     | Solana (Rust, Anchor) |
| Ingestion      | AWS Lambda |
| Event bus (MVP)| AWS SNS + SQS (fan-out) |
| Event bus (opt)| Kafka (Phase 3) |
| Operational DB | DynamoDB |
| Analytics store| BigQuery |
| Backend APIs   | gRPC (Go) |
| UI             | Elixir, Phoenix, LiveView |
| Infra          | Terraform (AWS + GCP) |
| CI/CD          | GitHub Actions (OIDC preferred) |
| Observability  | Grafana, CloudWatch, GCP Monitoring |

---

## Key References

- **Architecture and event bus:** `.cursor/rules/architecture.mdc`, `.cursor/rules/service_boundaries.mdc`, `.cursor/rules/system_context.mdc`
- **Event schema:** `.cursor/rules/event_schema.mdc`
- **Coding and service style:** `.cursor/rules/coding_style.mdc`, `.cursor/rules/service_style.mdc`
- **Agent workflow:** `.cursor/rules/agent/agent_workflow.mdc`
- **Testing:** `.cursor/rules/testing/` (general, Go, e2e, event-driven, smart contract, infra)
- **UI (Elixir/LiveView):** `.cursor/rules/user_interface/elixir_ui.mdc`

---

## Non-Goals

To keep scope achievable: no complex frontends, enterprise compliance frameworks, full data lake/ML pipelines, or large-scale identity. A minimal API and dashboards are sufficient.

---

*This README reflects the authoritative architecture and conventions defined in `.cursor/rules/`. For detailed decisions and evolution, see `docs/ADR/` and `docs/progress/`.*
