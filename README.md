# Chain-to-Cloud Governance & Voting

*On-chain policy. Off-chain projections.*

A Solana program enforces **commit–reveal** voting and, in later phases, **who may vote**. Each transition emits an event: Ingestion captures it on AWS, the bus fans out to independent consumers, and the Forwarder carries the same stream into analytics on GCP. Phoenix LiveView reads the operational view over gRPC; the wallet signs `commit_vote` and `reveal_vote` on-chain. Voters do not see live tallies until the program and Aggregator agree the vote is finished.

The repository is an **exploratory, hands-on build**—not a set of isolated technology demos. One product spans blockchain, event-driven services, AWS and GCP, Terraform, observability, and UI, with production-oriented practices: bounded services, ADRs, idempotent handlers, structured logs, least-privilege IAM. The directory remains *chain-to-cloud-ingestion* from the first milestone; the **system** now covers the program, projections, dashboards, and the full voter flow.

The hard part—and the point—is **keeping every layer consistent**: the same commitment formula, phase windows, and eligibility snapshot on-chain, in normalized events, in DynamoDB, and in what the UI may show.

---

## Purpose and Scope

Stack components are integrated into the voting pipeline, not maintained as separate exercises:

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
- **gRPC API** — Read and query APIs exposed by the Go services (e.g. ListProposals, GetProposal, WatchProposals, StreamProposalVotes, GetVoterParticipation, and analytics trends); contract for the Governance & Voting UI; exposed via API Gateway or gRPC-Web proxy as needed.

---

## System at a Glance

| Layer | Role |
|-------|------|
| **Solana program** | Commit–reveal voting, phase deadlines, eligibility (Phase 3); emits structured events |
| **Ingestion → event bus** | Chain → normalized JSON → SNS/SQS fan-out (thin adapter, no domain logic) |
| **Operational path (AWS)** | Aggregator → DynamoDB → gRPC (ballot, phases, participation, results when allowed) |
| **Analytical path (GCP)** | Forwarder → Pub/Sub → Analytics → BigQuery (history, trends, audit) |
| **UI + wallet** | LiveView reads gRPC; wallet writes commits and reveals on-chain |

---

## How the Scope Evolved

Documented in `docs/ADR/`, `docs/planning/`, and `.cursor/rules/` as the design matured:

| Stage | Direction |
|-------|-----------|
| **Early MVP** | Prove AWS path: chain → Ingestion → SNS/SQS → Aggregator; optional legacy **`VoteCast`** in handlers for pipeline tests. |
| **Governance model** | **Commit–reveal** (ADR 0003): no public choice on-chain during commit; tally from **`VoteRevealed`** only; UI hides counts until finalize. |
| **Eligibility (Phase 3)** | Global Merkle registry, grant/revoke, electorate snapshot on **`ProposalCreated`** (ADRs 0001, 0002)—not “any wallet on devnet” as the real program. |
| **Agreed shortcut (2026)** | **No throwaway VoteCast contract**; first on-chain product uses the target model; Ingestion/Aggregator migrate in one wave when the Anchor program lands. See [`docs/planning/agreed_direction_skip_votecast.md`](docs/planning/agreed_direction_skip_votecast.md). |
| **In progress** | `smart-contract/` workspace (crypto + Anchor scaffold); AWS services retain iteration-1 paths until the migration PR. |

Delivery phases are in `.cursor/rules/development_plan.mdc`. The table below records product decisions, not a parallel roadmap.

---

## Goals

With commit–reveal and the layer map defined, the central engineering task is **consistent rules across layers**—the same commitment hash, phase windows, and eligibility on-chain, in normalized events, in DynamoDB, and in gRPC.

- **Blockchain as product surface** — Event shapes, phases, and eligibility are fixed in ADRs and verified (golden fixtures, devnet) before downstream services depend on them.
- **Event-driven boundaries** — Loose coupling, replay-friendly seams, idempotent consumers under at-least-once delivery.
- **Service ownership** — Each backend owns its store; no cross-service DB access or synchronous RPC.
- **Multi-cloud CQRS** — AWS for operational reads; GCP for history and trends; Forwarder is transport only.
- **Governance semantics** — Commit–reveal, frozen electorate per proposal, auditable eligibility changes—not an open `vote(option_id)` program on devnet.
- **Operability** — Structured logs, correlation fields, metrics, DLQs, Grafana across clouds.
- **IaC and CI** — Terraform, GitHub Actions, OIDC where possible.

Scope is **substantial but bounded**: enough components to exercise integration and operations, without targeting national-election scale.

---

## Development Phases

| Phase | Focus |
|-------|--------|
| **1** | AWS operational pipeline: **Anchor program (commit–reveal)** in `smart-contract/`, Ingestion, SNS/SQS fan-out, Aggregator, DynamoDB, gRPC API; exit = devnet **commit → reveal → finalize** → bus → projection (no VoteCast placeholder contract) |
| **2** | GCP analytics: Forwarder, Pub/Sub, BigQuery, **UI first slice** (LiveView + Aggregator gRPC) |
| **3** | **Eligibility on-chain** (Merkle allowlist, grant/revoke, frozen electorate, audit events); voter UI read model fully aligned with phase/`results_visible` rules |
| **4** | Kafka (optional), **UI full slice** (streaming, trends), Grafana, E2E, production hardening |
| **5** | **Playground:** primitive voting UI + simulation orchestrator |

Details: `.cursor/rules/development_plan.mdc`.

---

## High-Level Architecture

**Mental model:** *Blockchain → event stream → projections.*

Layer map: **System at a Glance**. Architectural constraints:

- **Fan-out** — One SNS topic (or two SQS queues) so **Aggregator** and **Forwarder** both receive every event.
- **Thin adapters** — Ingestion and Forwarder capture or forward only; no domain logic in the path.
- **Contract + crypto** — Rust/Anchor program; ADRs **0001–0003** accepted; shared helpers and golden tests under `smart-contract/`.
- **Operational read model** — Aggregator projects DynamoDB from events; counts from **`VoteRevealed`** only; gRPC exposes `option_counts` when `results_visible`.
- **UI split** — LiveView reads gRPC; wallet submits commits and reveals on Solana. No interim tallies for voters.

**Data ownership:** Aggregator → DynamoDB; Analytics → BigQuery. Backends communicate by events only; the UI is a gRPC client plus wallet.

**Idempotency:** SQS and Pub/Sub provide at-least-once delivery; consumers deduplicate on `event_id` (or equivalent) and upsert.

---

## Voting Model (commit–reveal)

| Phase | On-chain | Voter-facing UI |
|-------|----------|-----------------|
| **Commit** | `commitment = hash(option ‖ salt ‖ voter ‖ proposal)` — **no `option_id` on chain** | Participation only; no choice visible |
| **Reveal** | `option_id` + salt verified; **`VoteRevealed`** emitted | Still no live Yes/No board for voters |
| **Finalized** | Tally fixed | **`option_counts`** when Aggregator sets `results_visible` |

- **Transparency** — Rules and commitments are public; anyone can verify reveals against commits afterward. It does **not** mean live scoreboards during voting.
- **Salt** — Voter-chosen, held off-chain until reveal; voting requires two on-chain transactions (commit, then reveal).
- **Legacy `VoteCast`** — Deprecated. Some AWS iteration-1 code may still handle it for pipeline tests; not the target program. Migration: [`docs/planning/agreed_direction_skip_votecast.md`](docs/planning/agreed_direction_skip_votecast.md).

### Voter UI (gRPC + wallet)

| Need | Source |
|------|--------|
| What is being voted on | Aggregator — title, options |
| Whether the voter participated | Aggregator — `has_committed`, `has_revealed`; wallet — commit/reveal txs |
| Time until phase ends | Aggregator — `commit_ends_at` / `reveal_ends_at`, `phase` |
| Results | Aggregator — `option_counts` when `results_visible` |

Details: **`.cursor/rules/user_interface/elixir_ui.mdc`**.

### Eligibility and transparency (Phase 3)

Global Merkle allowlist; electorate **frozen per proposal** at `ProposalCreated`; one active proposal at a time; append-only eligibility events (`EligibleVotersRootUpdated`, grant/revoke). Canonical off-chain list + `list_hash` per ADR 0001. Details: **architecture.mdc** (voter eligibility), **event_schema.mdc**, **`docs/ADR/`** (0001–0003).

---

## Repository Structure

```
smart-contract/          # Solana program (Rust/Anchor) + voting-crypto crate
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
  planning/
  progress/
  diagrams/
.github/workflows/
.cursor/rules/           # Architecture, boundaries, style, testing, agent workflow
```

---

## Event Schema

Events use a **canonical envelope**: `event_id`, `event_type`, `timestamp`, `source`, `version`. Payloads are JSON. Solana uses **slot** (not block number).

**Primary voting events:** `VoteCommitted`, `VoteRevealed`, `ProposalCreated` (with phase deadlines and electorate snapshot fields), `ProposalClosed`, `ProposalFinalized`, plus eligibility events in Phase 3. **`VoteCast`** is deprecated.

Schema evolution is additive only (new fields OK; no breaking renames). See `.cursor/rules/event_schema.mdc` and `architecture.mdc` (event schema).

---

## Technology Summary

| Area            | Choice |
|----------------|--------|
| Blockchain     | Solana (Rust, Anchor); commit–reveal + Merkle eligibility (ADRs 0001–0003) |
| Ingestion      | TypeScript, AWS Lambda (Node.js 20) |
| Event bus (MVP)| AWS SNS + SQS (fan-out) |
| Event bus (opt)| Kafka (Phase 4) |
| Operational DB | DynamoDB |
| Analytics store| BigQuery |
| Backend APIs   | gRPC (Go — Aggregator, Analytics) |
| UI             | Elixir, Phoenix, LiveView + wallet (commit/reveal txs) |
| Infra          | Terraform (AWS + GCP) |
| CI/CD          | GitHub Actions (OIDC preferred) |
| Observability  | Grafana, CloudWatch, GCP Monitoring |

---

## Developer tooling (repo root)

```bash
npm install          # root dev tools (Prettier)
npm run format       # format all languages (scripts/format-all.sh)
npm run format:check # CI-style format check
bash scripts/format-all.sh           # same as npm run format
bash scripts/format-all.sh --check     # same as npm run format:check
npm run audit        # npm audit (3 TS packages) + govulncheck + cargo audit when installed
npm run audit:production  # Ingestion Lambda runtime deps only
```

`format-all.sh` runs, when tools are installed:

| Layer | Tool | Scope |
|-------|------|--------|
| TypeScript | Prettier | `services/ingestion`, `tools/*`, `smart-contract/tests` |
| Go | `gofmt` | `services/aggregator` |
| Rust | `cargo fmt` | `smart-contract/` workspace |
| Terraform | `terraform fmt` | `infra/aws`, `infra/gcp` |

Optional installs for full audit coverage:

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
cargo install cargo-audit
```

---

## Key References

- **Architecture and event bus:** `.cursor/rules/architecture.mdc`, `.cursor/rules/service_boundaries.mdc`, `.cursor/rules/system_context.mdc`
- **Development phases:** `.cursor/rules/development_plan.mdc`
- **Active direction:** [`docs/planning/agreed_direction_skip_votecast.md`](docs/planning/agreed_direction_skip_votecast.md)
- **Decisions:** [`docs/ADR/README.md`](docs/ADR/README.md)
- **Event schema:** `.cursor/rules/event_schema.mdc`
- **Coding and service style:** `.cursor/rules/coding_style.mdc`, `.cursor/rules/service_style.mdc`
- **Agent workflow:** `.cursor/rules/agent/agent_workflow.mdc`
- **Testing:** `.cursor/rules/testing/` (general, Go, TypeScript/Ingestion, e2e, event-driven, smart contract, infra)
- **UI (Elixir/LiveView):** `.cursor/rules/user_interface/elixir_ui.mdc`
- **Primitive voting UI (Phase 5):** `.cursor/rules/user_interface/voting_ui.mdc`
- **Smart contract (local):** [`smart-contract/README.md`](smart-contract/README.md)
- **Documentation layout:** [`docs/README.md`](docs/README.md)

---

## Non-Goals

Out of scope: polished marketing frontends, enterprise compliance frameworks, full data-lake/ML platforms, or **government-grade KYC** on-chain. **Sybil resistance** applies to a **defined electorate** via an admin-managed allowlist (Phase 3), not open-network proof-of-personhood.

---

*Overview of `.cursor/rules/` and `docs/`. During migration, if this README is out of date, **Accepted ADRs** and **`docs/planning/`** are authoritative.*
