# ADR 0003 — Periodic snapshot over live replication for sandboxes

**Status:** Accepted · in production

## Context

The per-tenant sandboxes ([ADR 0001](0001-docker-over-bare-metal-for-tenant-isolation.md))
need realistic data to be useful — managers want to ask questions against
something that looks like production. Two ways to get it: attach each sandbox to
a live replica of production, or periodically copy production into each
sandbox's own database.

Live replication gives freshness but couples the sandboxes to production: a
sandbox (and the agent inside it) is now reading the same rows the business
depends on, replication lag and schema changes become shared concerns, and an
accidental write path is a much scarier thing.

## Decision

Refresh each sandbox every few hours from a production *mirror* via
dump-and-restore into the tenant's own database — swapping the refreshed data in
with a rename so a sandbox never sees a half-loaded copy, and preserving
tenant-local tables (e.g. per-tenant chat history). Each sandbox owns an
independent, writable copy.

## Consequences

- **Isolation and safety.** A sandbox can be written to, mangled, or reset
  freely; nothing it does reaches production. The refresh is also a free
  "reset to known-good" every few hours.
- **Predictable blast radius.** No replication topology to reason about, no
  lag, no risk that sandbox activity backpressures the primary.
- **Costs:** data is a few hours stale at most, and the dump/restore window has
  to fit between refreshes and scale with data size.

## When I'd revisit

If a use case needed *current* data (live dashboards, real-time ops), a
read-only replica is the right tool — but I'd keep it separate from the
writable sandbox path, not merge the two.
