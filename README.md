# infrastructure-patterns

Sanitized, generalized write-ups of infrastructure patterns I've designed and
operated in production — distilled into Architecture Decision Records (ADRs)
so the *reasoning* is visible even where the code can't be.

Most of this comes out of running a multi-portal PHP/MySQL reservations
platform plus its surrounding tooling (a Python agent-orchestration host,
per-tenant containerized AI sandboxes, a server-side deploy pipeline) as its
lead engineer. Those repositories are private;
these patterns are the parts that generalize, written at the architecture
level — no hostnames, addresses, credentials, or vendor specifics.

## Why ADRs

Each decision below is one where a non-obvious trade-off was made and can be
defended. That's the useful unit: not "what I used," but "what I chose, what I
gave up, and when I'd choose differently."

## Decision records

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0001](adr/0001-docker-over-bare-metal-for-tenant-isolation.md) | Docker over bare-metal for per-tenant isolation | Pay image/ops overhead to get strong filesystem + DB-user isolation cheaply |
| [0002](adr/0002-external-managed-db-over-containerized.md) | External managed DB over a containerized one | Give up "one compose up" simplicity for durable, backup-friendly state |
| [0003](adr/0003-periodic-snapshot-over-live-replication.md) | Periodic snapshot over live replication for sandboxes | Accept some staleness to gain isolation, reset-ability, and no prod write-path risk |
| [0004](adr/0004-shell-deploy-over-hosted-ci-runner.md) | A guarded shell deploy over a hosted CI runner | Forgo ecosystem features for a dependency-free, auditable single-server deploy |
| [0005](adr/0005-scoped-system-user-over-service-account.md) | A scoped system user over a shared service account for an autonomous agent | More host setup in exchange for clean per-action auditing and least privilege |
| [0006](adr/0006-binlog-daemons-over-database-triggers.md) | Binlog-tailing daemons over database triggers for denormalization | Accept eventual consistency to keep derive-logic in versioned code, off the hot write path |
| [0007](adr/0007-pull-probes-over-push-agents.md) | Pull-based health probing over push agents for a small fleet | Forgo deep metrics/history to keep the monitored fleet agent-free and the failure domain legible |
| [0008](adr/0008-embedded-sqlite-over-networked-db-for-tooling.md) | Embedded SQLite over a networked DB for single-node tooling | Give up cross-host sharing for zero operational surface on state one process owns |
| [0009](adr/0009-default-deny-host-pinned-db-access.md) | Default-deny, host-pinned DB access over a trusted network | Take on provisioning friction so a leaked credential isn't portable off its host |
| [0010](adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md) | A pixel-equality gate over diff review for changes to generated markup | Pay a render/diff harness to safely change markup you can't audit by eye — it proves visual, not semantic, equality |

## Format

Each ADR uses a short, consistent shape: **Context → Decision → Consequences →
When I'd revisit**. They're deliberately terse.
