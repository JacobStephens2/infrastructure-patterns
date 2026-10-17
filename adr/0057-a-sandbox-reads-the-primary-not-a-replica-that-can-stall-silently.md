# ADR 0057 - A sandbox reads the primary, not a replica that can stall silently

**Status:** Accepted · in production (a Manager Sandbox's SELECT-only production read path, in use since September 2026)

## Context

A debugging question needs the canonical server when a stale copy can answer
confidently and incorrectly. A Manager Sandbox needed to explain why production
behaved differently from its writable snapshot, especially whether a deployed
migration had applied. The obvious current-data source was a live replica:
already reachable, normally close behind production, and less consequential
than putting ad-hoc queries on the primary.

That was my recommendation going in. Then the replica wedged for 31 hours on
2026-09-20. A replica can answer the migration question correctly only while
replication is healthy. A stalled copy does not necessarily fail the query; it
can report that production lacks something production has. The freshness
assumption becomes part of every answer, and the answer carries no warning
that the assumption failed.

[ADR 0003](0003-periodic-snapshot-over-live-replication.md) chose snapshots for
the sandbox's writable dataset and named a read-only replica as the future
answer to current-data needs. The writable choice stands. This decision changes
the read source and accepts a production-load cost that the snapshot avoided.

## Decision

Give this sandbox a separate SELECT-only read path to the production primary.
Keep every sandbox write on the disposable copy. The decision depends on its
server-side limits and grant policy, rather than on an instruction to write
careful SQL.

- **Kill long statements on the server.** A recurring MySQL event issues
  `KILL QUERY` for the designated read-only accounts when a statement runs past
  60 seconds. It fails the statement while preserving the connection. A
  client-supplied timeout is not the boundary; the client cannot remove this
  event from its own invocation.
- **Match the intended accounts literally.** The killer compares a literal
  suffix. In a SQL `LIKE` pattern, an underscore is a wildcard, and escaping
  passes through string parsing too. A rule meant for read-only accounts must
  not accidentally select unrelated application accounts.
- **Bound the account separately.** Require TLS, pin the account to its source
  host, and cap it at 3 connections and 1000 queries per hour. The firewall and
  the host-bound grant are separate gates, as in
  [ADR 0009](0009-default-deny-host-pinned-db-access.md).
- **Compile exclusions into exact grants.** MySQL grants cannot subtract from
  a broad schema grant. A reviewed role policy therefore produces individual
  table or column `SELECT` grants, excluding data outside the staff role's
  permissions and secret-bearing data. A pure planner computes the difference;
  the dry-run and applying reconciler use that same decision function.
- **New tables are readable unless excluded.** The table a migration just
  created is precisely what this debugging path needs to inspect. Exclusion
  patterns still win, including for new tables. The hourly reconciler applies
  the resulting grant changes instead of relying on someone remembering to
  refresh them after each migration.
- **Keep a command as the interface.** It is the seam a future authenticated
  read service can replace internally without changing every caller's
  instructions. The interface does not settle which database that future
  service should read.

## Consequences

- **Read-only is not load-free.** A long `SELECT` can hold a metadata lock that
  a migration queues behind, with later queries queuing behind the migration.
  The source decision names a replica pileup that lasted 3.4 hours as the
  failure being guarded against on production. Removing the killer or account
  limits reopens the decision; the read grant alone is insufficient.
- **The exclusion policy is deliberate default access.** It is cheaper to keep
  debugging newly deployed structures, at the cost of reviewing new sensitive
  data against the exclusions. A new table does not wait for a positive
  permission entry before becoming readable.
- **A client pin does not pin the destination.** The grant also replicated onto the warm standby, whose firewall admitted
  the same client. That reach was checked and accepted in writing on 2026-09-22. Grant
  review must include the replicas, rather than treating them as unrelated
  because nobody created the account there by hand.
- **The writable sandbox remains a snapshot.** This adds a narrow production
  read purpose; it does not make production the sandbox's application database
  or remove pull requests and engineering review from code promotion.

## When I'd revisit

Revisit when an authenticated read service can own query limits, caller
attribution, and the database connection behind the existing command. Ask the
primary-versus-replica question again with that interface in place. Revisit
immediately if the server-side controls prove insufficient; the replica was
rejected for this question, not ruled out for every future read workload.
