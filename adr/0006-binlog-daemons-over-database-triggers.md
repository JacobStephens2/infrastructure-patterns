# ADR 0006 - Binlog-tailing daemons over database triggers for denormalization

**Status:** Accepted · in production

## Context

A read-heavy reservations system keeps a lot of *derived* data in sync with its
source rows - rolled-up totals, denormalized copies of a value onto the rows
that query it, search-friendly projections. The in-database default for keeping
derived data current is a TRIGGER that fires on every write. But triggers run
*inside* each writing transaction and are invisible to the application. They're
awkward to test, version, and deploy - they're schema DDL, not code - and a slow
or buggy one adds latency to (or wedges) the hot write path.

## Decision

Move the sync logic out of the database and into a set of small daemons that
tail the database's replication log (binlog) under a process manager. They react
to committed row changes asynchronously and write the derived data back. The
logic lives in application code, in version control, deployed like everything
else (see [ADR 0004](0004-shell-deploy-over-hosted-ci-runner.md)).

## Consequences

- **Logic lives in the app, not the schema.** It's versioned, reviewable, and
  testable, and ships through the normal pipeline - not hidden DDL that only
  shows up in a schema dump.
- **The write path stays fast.** Producers commit without waiting on derivation
  work; the daemons absorb bursts and can be paused and replayed.
- **Replayable by position.** A daemon can be restarted from a known log
  position to rebuild derived state after a bug or outage - a handle a trigger
  simply doesn't give you.
- **Costs:** the derived data is eventually consistent (it lags by the daemon's
  processing time); the source must retain its binlogs long enough for the
  daemons to consume them; and you own the daemons' lifecycle - supervision,
  restart-from-position, and idempotency so a replay can't double-apply.

## When I'd revisit

For an invariant that must hold *within* the writing transaction - a hard
correctness constraint, not a derived convenience - a trigger or a database
constraint is the right tool. Anything that can't tolerate lag belongs in the
database; everything that can is cheaper and safer to own as code.
