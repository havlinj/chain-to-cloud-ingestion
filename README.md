# Chain-to-Cloud Ingestion

## Purpose and Scope

This is an **exploratory, experimental, learning-focused project**. The goal is to combine a chosen set of technologies and apply them in a single use case that is rigorous enough to stand as a real system—using solid development practices, clear boundaries, and production-style operational thinking. The project is explicitly designed to train exposure to and practice with the following:

- **Agentic AI development workflow** — Cursor-driven, approval-based iteration; rules in `.cursor/rules/` steer the AI agent toward small steps, explicit confirmation, and documented progress.
- **Cloud services** — **AWS** (operational path: Lambda, SQS, SNS, DynamoDB, API Gateway, CloudWatch) and **GCP** (analytics path: Pub/Sub, Cloud Run, BigQuery, Cloud Monitoring).
- **Infrastructure as Code** — **Terraform** for all infrastructure (`infra/aws`, `infra/gcp`); environment separation, least-privilege IAM, and OIDC-based CI/CD where applicable.
- **Microservices** — Bounded services (Ingestion, Aggregator, Forwarder, Analytics, plus smart contract and UI) with strict ownership of data and no synchronous cross-service RPC.
- **Event-driven architecture** — Blockchain as immutable event source; all downstream processing via events only; at-least-once delivery and idempotent consumers.
- **Solana blockchain integration** — Voting logic implemented as a **Solana program** (Rust, Anchor); contract emits structured events consumed off-chain.
- **Messaging middleware** — AWS SQS/SNS for MVP fan-out; **Kafka** is an optional **Phase 4** evolution for replay, consumer lag, and stronger log semantics.
- **System observability** — **Grafana** for cross-cloud dashboards; datasources include CloudWatch, GCP Monitoring, and BigQuery; structured logs and correlation fields for traceability.
- **Go** — Primary language for Aggregator and Analytics services; clean layering (handlers, service, domain, repository), idiomatic Go, and strict idempotency in event handlers.
- **TypeScript** — Ingestion service on AWS Lambda (Node.js 20); thin blockchain-to-SNS adapter with normalized event envelopes; Vitest for unit tests.
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
- **Production-usable governance (Phase 3)** — Global **Merkle allowlist** on-chain so random wallets cannot vote; admin can **grant** or **revoke** eligibility without relying on off-chain checks alone.
- **Observability-first** — Structured logging, correlation IDs, metrics, and Grafana dashboards.
- **Infrastructure as Code** — Terraform, GitHub Actions, and production-style operational mindset.

The system is intended to feel like a **realistic cloud-native system**, not a toy demo.

---

## Development Phases

| Phase | Focus |
|-------|--------|
| **1** | AWS operational pipeline: contract (basic), Ingestion, SNS/SQS, Aggregator, DynamoDB, gRPC API |
| **2** | GCP analytics: Forwarder, Pub/Sub, BigQuery, **UI first slice** (LiveView + Aggregator gRPC) |
| **3** | **Commit–reveal voting** + Merkle allowlist; frozen electorate; voter UI read model |
| **4** | Kafka (optional), **UI full slice** (streaming, trends), Grafana, E2E, production hardening |
| **5** | **Playground:** primitive voting UI + simulation orchestrator |

Details: `.cursor/rules/development_plan.mdc`.

---

## High-Level Architecture

**Mental model:** *Blockchain → Event stream → Projections.*

1. **Smart contract** (Solana, Rust/Anchor) — **Commit–reveal** voting (`commit_vote`, `reveal_vote`); global eligibility (Phase 3); emits `VoteCommitted`, `VoteRevealed`, proposal lifecycle and eligibility events.
2. **Ingestion** (TypeScript, AWS Lambda) — Connects to chain RPC, normalizes events, publishes to SNS. No business logic; strictly an adapter from blockchain to bus.
3. **Event bus (fan-out)** — One SNS topic (or two SQS queues) so that **Aggregator** and **Forwarder** both receive every event.
4. **Aggregator** (Go, AWS) — Consumes from SQS, maintains the **operational projection** in DynamoDB (proposals, vote counts, voter activity). Exposes **gRPC read API** for the UI.
5. **Forwarder** (AWS Lambda) — Consumes from SQS, forwards events to **GCP Pub/Sub**. Stateless bridge only.
6. **Analytics** (Go, GCP Cloud Run) — Consumes from Pub/Sub, writes raw events to BigQuery, builds analytical tables; optionally exposes gRPC query API for trends.
7. **User interface** — Phoenix LiveView: **reads** Aggregator gRPC (ballot, participation, countdown, results after finalize); **writes** votes via wallet to Solana (`commit` + `reveal`). No interim result tallies for voters during voting.

**Data ownership:** Aggregator owns DynamoDB; Analytics owns BigQuery. No service reads or writes another service’s store. Communication is **event-only**; the UI is a gRPC client.

**Idempotency:** Delivery is at-least-once (SQS, Pub/Sub). Every event consumer must be idempotent (e.g. event_id deduplication, upserts).

---

## Voting Model (commit–reveal)

- **Commit phase** — Voters submit a hash commitment; **choice is not on-chain**.
- **Reveal phase** — Voters submit `option_id` + salt; program verifies and tallies.
- **Results** — Shown in UI only after reveal ends (`results_visible` from Aggregator). No live Yes/No board for voters during voting (reduces bandwagon effect; chain analysts can still inspect commitments).

Aggregator iteration 1 may still process legacy **`VoteCast`** for pipeline tests; production target is **`VoteCommitted`** / **`VoteRevealed`**.

## Voter UI (same app: gRPC + wallet)

| Need | Source |
|------|--------|
| What is being voted on | Aggregator — title, options |
| Whether the user voted | Aggregator — `has_committed`, `has_revealed`; wallet — commit/reveal txs |
| Time until phase ends | Aggregator — `commit_ends_at` / `reveal_ends_at`, `phase` |
| Results | Aggregator — `option_counts` when `results_visible` |

Details: **`.cursor/rules/user_interface/elixir_ui.mdc`**.

## Eligibility and transparency (Phase 3)

Global Merkle allowlist, frozen electorate per proposal, one active proposal, immutable eligibility audit events. See **architecture.mdc** §8, **event_schema.mdc**, **docs/ADR/** (`0001`, `0002`, `0003`).

---

## Repository Structure

```
smart-contract/          # Solana program (Rust/Anchor)
services/
  ingestion/             # TypeScript, AWS Lambda — chain → SNS
  aggregator/            # Go — SQS → DynamoDB, gRPC API
  forwarder/             # AWS Lambda — SQS → Pub/Sub
  analytics/             # Go, GCP — Pub/Sub → BigQuery, optional gRPC
user_interface/          # Elixir/Phoenix LiveView — gRPC client
tools/                   # Phase 3: eligibility admin; Phase 5: voting UI, orchestrator
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
| Ingestion      | TypeScript, AWS Lambda (Node.js 20) |
| Event bus (MVP)| AWS SNS + SQS (fan-out) |
| Event bus (opt)| Kafka (Phase 4) |
| Operational DB | DynamoDB |
| Analytics store| BigQuery |
| Backend APIs   | gRPC (Go — Aggregator, Analytics) |
| UI             | Elixir, Phoenix, LiveView |
| Infra          | Terraform (AWS + GCP) |
| CI/CD          | GitHub Actions (OIDC preferred) |
| Observability  | Grafana, CloudWatch, GCP Monitoring |
| Voting model | Commit–reveal on-chain; results in UI after finalize |
| Voter eligibility | Global Merkle allowlist + grant/revoke (Phase 3) |

---

## Key References

- **Architecture and event bus:** `.cursor/rules/architecture.mdc`, `.cursor/rules/service_boundaries.mdc`, `.cursor/rules/system_context.mdc`
- **Development phases:** `.cursor/rules/development_plan.mdc`
- **Event schema:** `.cursor/rules/event_schema.mdc`
- **Coding and service style:** `.cursor/rules/coding_style.mdc`, `.cursor/rules/service_style.mdc`
- **Agent workflow:** `.cursor/rules/agent/agent_workflow.mdc`
- **Testing:** `.cursor/rules/testing/` (general, Go, TypeScript/Ingestion, e2e, event-driven, smart contract, infra)
- **UI (Elixir/LiveView):** `.cursor/rules/user_interface/elixir_ui.mdc`
- **Primitive voting UI (Phase 5):** `.cursor/rules/user_interface/voting_ui.mdc`

---

## Non-Goals

To keep scope achievable: no complex frontends, enterprise compliance frameworks, full data lake/ML pipelines, or **government-grade KYC** on-chain. **Sybil resistance** for a defined electorate is in scope via **admin-managed allowlist** (Phase 3), not proof-of-personhood for the entire internet.

---

*This README reflects the authoritative architecture and conventions defined in `.cursor/rules/`. For documentation layout (ADR, planning, progress), see [`docs/README.md`](docs/README.md).*
