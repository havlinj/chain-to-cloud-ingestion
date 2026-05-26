# Project documentation

How documentation in this repository is organized. Architecture **rules** for code and services live in `.cursor/rules/`; this tree is for **human-readable records** (decisions, direction, history).

## Folder layout

| Folder | Purpose | Typical lifetime |
|--------|---------|------------------|
| [`ADR/`](ADR/) | **Architecture Decision Records** — durable decisions (what we chose and why). Status: Proposed → Accepted (or Superseded). | Long-lived; amend via new ADR, do not silently rewrite Accepted docs. |
| [`planning/`](planning/) | **Active direction** — working agreements, spikes, “where we are heading now” before or while coding. | Until merged into an Accepted ADR or reflected in `development_plan.mdc`; then archive or delete. |
| [`progress/`](progress/) | **Session recaps** — what was implemented in a work block (files touched, commits, verification). | Historical log; add new files per session/milestone, rarely edit old entries. |

**Flow (recommended):** discuss in `planning/` or an issue → lock in **`ADR/`** when the decision is final → implement → record outcome in **`progress/`**.

Process for ADRs: `.cursor/rules/adr_process.mdc`.

## Glossary (common abbreviations)

| Term | Meaning |
|------|---------|
| **ADR** | **Architecture Decision Record** — a short document capturing an important technical decision, its context, and consequences. See `docs/ADR/`. |
| **WIP** | **Work in progress** — not final; safe to change. Documents in `planning/` are usually WIP until promoted to an ADR or the plan. |
| **RFC** | **Request for Comments** — a proposal written for review before a decision (common in large orgs). This repo uses **Proposed ADRs** and **`planning/`** notes instead of a separate RFC folder; the idea is the same: propose → discuss → accept. |

## Current pointers

- **Active direction:** [`planning/agreed_direction_skip_votecast.md`](planning/agreed_direction_skip_votecast.md)
- **Decisions (review status):** [`ADR/README.md`](ADR/README.md)
- **Latest session recap:** [`progress/session_10.md`](progress/session_10.md)
