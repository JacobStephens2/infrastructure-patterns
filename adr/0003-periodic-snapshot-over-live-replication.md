# ADR 0003 - Periodic snapshot over live replication for Manager Sandboxes

**Status:** Accepted · in production (nightly shared writable copy; amended September 2026 for a separate production read path)

## Context

The Manager Sandboxes ([ADR 0001](0001-docker-over-bare-metal-for-tenant-isolation.md))
need realistic data to be useful - managers want to ask questions against
something that looks like production. The original choice was between a live
replica and a periodic copy that sandbox experiments could write to and reset.

Live replication gives freshness but brings replication lag and schema changes
into the sandbox's operating model. It also does not supply the independently
writable, disposable dataset that experimentation needs.

## Decision

Use dump-and-restore for the writable sandbox dataset, loading a temporary copy
and swapping it in rather than exposing a half-loaded restore. Preserve local
sandbox state that must survive the refresh.

I originally refreshed separate sandbox databases every few hours. They became
one shared writable database in June 2026, and the refresh became nightly on
2026-07-31. The application containers remain separate; the data is shared.

## Consequences

- **Sandbox writes stay on the copy.** Experiments do not write production
  data. A refresh replaces the shared dataset, so a manager's database
  experiments can affect the other sandboxes until that refresh.
- **The writable copy has no live replication dependency.** Its refresh is a
  deliberate operation, rather than a stream it must keep consuming.
- **Costs:** nightly refresh trades freshness for less restore load. Failed
  refreshes can leave the copy older still, so freshness needs monitoring.
  The dump/restore window must fit between refreshes and scale with data size.

## Amendment - 2026-07-31

The four-hourly cadence cost more than the freshness was worth. The source
runbook records repeated restore load and two database outages before the
schedule moved to nightly. I would cut restore time before attempting a
sub-daily cadence again. The shared writable database and daily refresh are
also described in the
[published case study](https://stephens.page/blog/one-engineer-platform-production-systems/).

## Amendment - 2026-09-22

The original claim that nothing a sandbox does reaches production no longer
holds. A separate SELECT-only path now reads the production primary; sandbox
writes still go to the snapshot. Read-only queries still consume production
resources, so this path depends on server-side query limits and account limits.

The question was whether a production migration had applied. I originally
recommended a replica for current-data needs, but a stalled replica can report
that a row or schema change is absent instead of failing. That made the primary
the better source for this question.
[ADR 0057](0057-a-sandbox-reads-the-primary-not-a-replica-that-can-stall-silently.md)
records the choice and its controls. The separation between the current-data
read path and the writable sandbox path survived; the choice of replica did
not.

## When I'd revisit

Revisit the writable snapshot's cadence when restore cost or freshness needs
change. Revisit the current-data source when an authenticated read service can
enforce the same limits behind its own interface. Neither change is a reason
to merge the production read path into the writable sandbox dataset.
