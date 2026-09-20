# ADR 0040 - Serial rounds run as harness subagents, over detached parallel CLI processes

**Status:** Accepted · in production (the spec-implementation workflow used for overnight agent runs; supersedes two earlier decisions in the same workflow)

## Context

A spec is broken into tickets, and an orchestrating agent session works through
them in **rounds**: one ticket, one fresh-context worker, one worktree, one
gate. Runs happen overnight with nobody watching.

The first design optimized for two things that sounded obviously good.

- **Parallelism.** Tickets on the dependency frontier ran at the same time.
- **Survival.** Each round was a detached headless CLI process, so it would
  outlive the orchestrator's session if that session died.

Both were measured against what they cost. On the third spec run this way, two
frontier tickets ran in parallel and the second one paid for it with a merge
round, a re-gate, and a second correction. The saving was about ten minutes of
wall clock. Detachment, for its part, needed scripts to detach, launch, resume,
review, watch, and invoke: a Python and process-inspection layer with no
Windows form, and a continue flag that once resumed the wrong session after a
review had run in the same worktree.

## Decision

- **One round at a time per machine.** One spec per base branch at a time; the
  next ticket is the lowest-numbered one on the frontier; its worktree is cut
  from the current tip when its round starts, not before.
- **A round is a subagent of the orchestrator's own harness**, spawned with
  whatever that harness calls its fresh-context worker. Three different
  vendors' harnesses all have one, so the workflow names the mechanism and not
  the product, and the launcher and CLI recipe were deleted with the scripts.
- **A round's output stays out of the orchestrator's context.** The
  orchestrator holds the ledger and the tail of the test suite, nothing else.

The reasoning that ties them together: overnight, wall clock is free and every
extra round is a place to fail. And once rounds are serial, a dead orchestrator
ends the run whether or not the current round survives it, so detachment was
buying survival for a process with nothing left to report to.

## Consequences

- **Throughput is given up on purpose.** A spec takes as long as its tickets
  laid end to end.
- **A class of machinery is retired**: the automatic merge, memory and
  concurrency accounting, sibling-spec bookkeeping, and most of the workflow's
  OS-specific instructions, which existed to manage the processes.
- **No merge rounds.** Each worktree is cut from a tip that already contains
  the previous round, so the conflict that cost a re-gate cannot occur.
- **The run dies with the orchestrator's session.** That is now a stated
  property rather than an accident to engineer around.
- **The workflow is portable across harnesses** because it depends on a concept
  they share rather than on one vendor's flags.

## When I'd revisit

If runs become attended - someone waiting on the result - wall clock stops
being free and bounded parallelism earns its merge cost back. If a single spec
outgrows one session's lifetime, the answer is a resumable ledger the next
session picks up, not detached processes: the ledger is already the only state
that matters.
