# ADR 0063 - Watch the work, not the process, with a window longer than the stall

**Status:** Accepted · in production (the reservations platform's daemon watchdog and checkpointed replication consumer; live restart and installed schedule verified)

## Context

A process marked online was doing no work. One daemon stayed online through a
stall lasting ~14 hours. The watchdog checked presence and restart counts, so the
reading stayed healthy while the work stayed unfinished.

A separate replication consumer stayed connected for over a year without
sending its alerts. Its event filter passed enum cases to a library that
compared incoming integers strictly. The connection was real; every event
failed the filter. Neither process presence nor an open replication connection
proved that the consumer had handled anything.

These were different bugs with the same observability failure. The existing
check asked whether a process could be found, where the operator needed to
know whether expected work had been completed. A heartbeat written by the
consumer would still have been the consumer testifying about itself.

The first attempt at a work check also needed a time boundary. The stalled
daemon produced the scheduling evidence the watchdog would inspect. Once it
stalled, it produced no fresh evidence. With an hour-long lookback, the work
it had already missed would age out and the watchdog would announce recovery
in the middle of the stall. A shorter query was not simply a faster detector.

## Decision

**Check unfinished work independently of process presence, and keep its
evidence in view longer than the stall it must expose.** Presence and restart
checks remain; they answer a different question.

- **Compare the recorded obligation with its current result.** The watchdog
  checks whether work logged as due remains unapplied, after a 5-minute grace
  period. It uses a 24-hour lookback rather than an hour, so the observed
  long stall does not erase its own evidence from the query.
- **For the replication consumer, compare source progress with handled
  progress.** The consumer persists the newest source modification timestamp
  it has handled. The watchdog asks whether later source writes, old enough
  to clear the grace period, remain beyond that marker. Both values come from
  the same source field; the consumer's clock is not another definition of
  when the write happened.
- **Missing evidence is a problem.** A missing or unreadable checkpoint raises
  an alert. An inspection error also becomes a problem rather than an empty
  result interpreted as no outstanding work. This is the same boundary as
  [ADR 0038](0038-guardrail-reads-every-unattended-tree-unknown-is-never-green.md):
  unknown must not become green.
- **Persist a restart position as well as a liveness marker.** The consumer
  saves a binlog position at a completed transaction boundary. It resumes a
  checkpoint under 7 days old, inside the source's 14 days of log retention.
  A restart can replay the transaction interrupted by a crash. A duplicate
  alert is accepted over a lost one.

That last choice makes recovery visible without pretending it is exactly-once
delivery. A failed side effect is reported and skipped rather than killing the
consumer and replaying the same failing transaction forever. A refused saved
position is logged before starting from the current stream position. Resume
is bounded recovery, not a promise to replay every possible outage.

## Consequences

- **The check observes the work product.** It can detect a process that is
  alive, connected, and handling nothing. The pull-probe principle in
  [ADR 0007](0007-pull-probes-over-push-agents.md) now reaches below presence
  into an application invariant.
- **A longer window costs a wider read and a slower-closing alert.** Recovery
  follows the state of the outstanding work, not merely a process restart.
  The lookback is still bounded: it does not preserve evidence indefinitely.
  Its duration must be part of the detector's stated coverage.
- **A progress marker is only as broad as its source.** Changes that do not
  advance the source timestamp are outside that liveness comparison. Matching
  clocks avoids one false answer; it does not establish coverage of every
  mutation or successful delivery to every recipient.
- **Checkpointing is a shipped consumer behavior, not a free property of
  binlogs.** [ADR 0006](0006-binlog-daemons-over-database-triggers.md) describes
  the replay handle. This consumer actually persists and uses it. The daemon
  and watchdog are deployed, but the original change checked resume against
  the library source and did not exercise it against a live binlog before
  merge. A deployed restart is not proof of a crash-replay drill.

## When I'd revisit

If an outage can outlast the lookback, I would retain unresolved obligations
until settled rather than let age remove them from the detector. If missed
side effects become more costly than duplicates, a checkpoint alone is the
wrong contract: durable delivery state and explicit retry policy must own
that boundary. A shorter detection interval earns nothing if the evidence
expires sooner than the failure being detected.
