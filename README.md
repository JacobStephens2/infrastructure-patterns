# infrastructure-patterns

Sanitized, generalized write-ups of infrastructure patterns I've designed and
operated in production — distilled into Architecture Decision Records (ADRs)
so the *reasoning* is visible even where the code can't be.

Most of this comes out of running a multi-portal PHP/MySQL reservations
platform plus its surrounding tooling (a Python agent-orchestration host,
per-tenant containerized AI sandboxes, a server-side deploy pipeline) as the
lead engineer for a specialty-travel operator. Those repositories are private;
these patterns are the parts that generalize, written at the architecture
level — no hostnames, addresses, credentials, or vendor specifics.

## Why ADRs

Each decision below is one where a non-obvious trade-off was made and can be
defended. That's the useful unit: not "what I used," but "what I chose, what I
gave up, and when I'd choose differently."

## Decision records

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0001](adr/0001-docker-over-bare-metal-for-tenant-isolation.md) | Docker over bare-metal for per-tenant isolation | Pay image/ops overhead to get hard filesystem + DB-user isolation cheaply |
| [0002](adr/0002-external-managed-db-over-containerized.md) | External managed DB over a containerized one | Give up "one compose up" simplicity for durable, backup-friendly state |
| [0003](adr/0003-nightly-snapshot-over-live-replication.md) | Nightly snapshot over live replication for sandboxes | Accept staleness to gain isolation, reset-ability, and zero prod risk |
| [0004](adr/0004-shell-deploy-over-hosted-ci-runner.md) | A guarded shell deploy over a hosted CI runner | Forgo ecosystem features for a dependency-free, auditable single-server deploy |
| [0005](adr/0005-scoped-system-user-over-service-account.md) | A scoped system user over a shared service account for an autonomous agent | More host setup in exchange for clean per-action auditing and least privilege |

## Format

Each ADR uses a short, consistent shape: **Context → Decision → Consequences →
When I'd revisit**. They're deliberately terse.
