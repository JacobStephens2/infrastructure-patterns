# ADR 0006 - Binlog-tailing daemons over database triggers for denormalization

**Status:** Accepted · in production (derived-data daemons; checkpoint behavior amended 2026-09-28)

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
  work; the daemons absorb bursts. Recovering a missed interval depends on
  each consumer's checkpoint and replay policy.
- **Replay requires a checkpoint.** The log exposes positions, but the
  consumer must persist and resume from one. Tailing alone does not provide
  recovery, and a process that starts at the current position misses changes
  written while it was down.
- **Costs:** the derived data is eventually consistent (it lags by the daemon's
  processing time); the source must retain its binlogs long enough for the
  daemons to consume them; and you own the daemons' lifecycle - supervision,
  checkpointing and replay policy. A consumer can hold a connection open
  while doing no work, so process presence is not a sufficient health check.

## Amendment - 2026-09-28

The original record claimed replayability for the architecture before the
consumers supplied it. One notification consumer now checkpoints the end of a
completed transaction and resumes if that checkpoint is under 7 days old. A
restart can resend the transaction it died in; a duplicate is preferred to a
lost alert. An expired or refused position falls back to the current position,
so this is bounded recovery, not a promise to reconstruct all missed work.

Replay is also a domain decision. Another consumer's startup replay was removed
in September rather than applying missed actions later. The right policy
cannot be inferred from the fact that both consume the same log.

[ADR 0063](0063-watch-the-work-not-the-process-with-a-window-longer-than-the-stall.md)
records the companion monitoring rule: check completed work and checkpoint
progress, not just whether the daemon is online.

## When I'd revisit

For an invariant that must hold *within* the writing transaction - a hard
correctness constraint, not a derived convenience - a trigger or a database
constraint is the right tool. Anything that can't tolerate lag belongs in the
database; everything that can is cheaper and safer to own as code.
