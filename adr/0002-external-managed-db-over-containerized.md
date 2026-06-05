# ADR 0002 - External managed database over a containerized one

**Status:** Accepted · in production

## Context

The containerized per-tenant app instances (see
[ADR 0001](0001-docker-over-bare-metal-for-tenant-isolation.md)) need a
database. The tempting default is to drop a database service into the same
compose file - one `docker compose up` brings up the whole world. But the
database holds the only state that actually matters, and the containers around
it are meant to be disposable and frequently rebuilt.

## Decision

Keep the database on a dedicated, separately-managed host (a managed instance
with its own backup, monitoring, and upgrade lifecycle) and point the
containers at it over the network with per-tenant users, locked down per
[ADR 0009](0009-default-deny-host-pinned-db-access.md). The containers stay
stateless and cattle; the data tier is a pet, on purpose.

## Consequences

- **Durability decoupled from app churn.** Rebuilding, destroying, or
  re-imaging an app container can never touch the data. Backups, point-in-time
  recovery, and version upgrades happen on a host built for exactly that.
- **One place to reason about data.** Capacity, slow queries, and grants live
  in one managed system instead of being scattered across ephemeral containers.
- **Costs:** you lose the single-command bring-up; local/dev needs a story for
  the DB (a throwaway container is fine *there*, where statelessness is the
  point), and you take on network-path and connection-pool concerns.

## When I'd revisit

For a genuinely ephemeral environment (CI, a preview that's torn down hourly),
a containerized DB seeded from a snapshot is the right call - there, losing the
data *is* the feature.
