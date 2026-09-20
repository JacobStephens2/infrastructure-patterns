# ADR 0036 - Bound unattended dispatch by human review capacity, over a daily spend cap

**Status:** Accepted · in production (the unattended loop from [ADR 0023](0023-attendedness-is-a-fourth-trust-axis.md), dispatching against a live product's work tracker)

## Context

The unattended loop picks a ticket, runs an agent against it inside the
execution boundary, and opens a draft pull request. Something has to stop it
from dispatching forever. The first bound was a rolling daily cap: four
dispatches per twenty-four hours, chosen when the risk being managed was what a
day of dispatches could cost.

Two things changed underneath it. The model credential became a flat-rate
subscription ([ADR 0025](0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md)),
and metered keys stayed barred, so the money boundary was already fixed by
something the loop could not exceed. And a cycle started draining the queue
rather than taking one ticket per wake-up. Under those two facts the daily cap
failed in both directions at once: it starved the pipeline on days when I had
time to review, and it did nothing to protect me from a deluge of open proposals on
days when I did not.

The cap was counting the wrong scarce thing. An unattended agent's output is
worth nothing until a human has reviewed it, so the binding constraint on
throughput is review, not generation.

## Decision

Delete the daily cap, its rolling window, and every counter that fed it. Bound
dispatch by the size of the review queue instead.

- **Review capacity is per target.** Each target repository declares its own
  `review_cap` (default 20). It is a property of that repository's reviewers
  and their pace, not a global setting on the instance.
- **The review queue is read on every drain pass**, not once per cycle, so a
  cycle that fills the queue stops mid-drain.
- **The halt is deterministic and journaled.** When items awaiting review reach
  the cap, dispatch stops with a named halt reason, and the count read and the
  cap it was compared against are both written to the journal. "Why did it stop
  at three?" is a query, not a guess.
- **One function computes the budget**, used by the engine to enforce it and by
  the status page to display it. The page and the engine cannot drift because
  there is no second implementation to drift.
- **No residue.** The old cap's environment variable, config key, window
  constant, and both counters were removed rather than left defaulted.

## Consequences

- **Throughput tracks review velocity.** The loop works when I have capacity
  and idles when I do not, without my telling it which day is which.
- **Headroom returns immediately.** Merging or closing one reviewed item frees
  one slot on the next cycle. The rolling window made me wait out the clock
  after I had already caught up.
- **A hard spend ceiling is given up.** That is only acceptable because the
  subscription is the ceiling. This decision is downstream of the billing
  model and says so.
- **The history page stays journal-only.** Live capacity reads the tracker;
  run history never does, so a tracker outage cannot blank the record of what
  the loop already did.

## When I'd revisit

If billing becomes metered again, a spend bound comes back beside the review
bound, not instead of it - they guard different things. If a second reviewer
joins, `review_cap` stops being a number I can set from my own calendar and
wants to be derived from observed merge rate per target.
