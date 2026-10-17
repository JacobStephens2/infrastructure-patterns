# ADR 0061 - Release the session lock before slow work, on the request that holds it

**Status:** Accepted · in production (the reservations platform's slow request paths; shipped but not re-measured in production)

## Context

One user's requests were waiting on each other while the servers were healthy.
A staff member reported slow queues after processing a payment. The aggregate
latency, CPU, database, and worker-capacity readings did not explain it. The
slow requests were the pages the person had named, including pollers that
normally finished quickly. They were waiting rather than doing expensive work.

PHP's file session handler holds an exclusive lock from `session_start()`
until the request ends or releases it. Requests carrying the same session
cookie therefore run one at a time. A page waiting on a payment gateway holds
up that person's other tabs and background polls. Other users have different
session files and do not wait for that lock. A fleet-wide aggregate is the
wrong scope for this contention.

A local reproduction separated the possibilities. The poller alone took
0.002 s. Behind a slow page with the same session it took 2.70 s; with a
different session it took 0.002 s again. Releasing the lock in the poller
still took 2.70 s. Releasing it in the slow page before the wait brought the
poller to 0.001 s. The same verdict held on 3 of 3 runs.

That fourth case matters. The fast request cannot release a lock it is still
waiting to acquire. The change belongs to the request holding the lock, not
to the requests that make its cost visible.

## Decision

**Release the session after authentication and its last write, before the
slow work.** Apply that boundary to the four slow pages, rather than changing
the session backend or every request in the application.

- **Keep setup under the lock.** Authentication, session initialization, and
  the page's last session mutation finish before `session_write_close()`.
  Reading session values afterwards is permitted. Writing them afterwards
  would silently lose those changes, so the release point is a correctness
  boundary as well as a performance change.
- **Trace the code reached after the release.** The page alone is not the
  whole request. Its payment service, gateway adapters, and later-loaded
  libraries must neither write the session nor reopen it. Reopening would
  acquire the lock again and restore the delay.
- **Pin the boundary with a wiring test.** It asserts that release comes after
  setup and before slow work, that the remaining page contains no session
  write or reopen, and that the called libraries remain read-only with
  respect to the session. The write detector is checked against assignments,
  compound assignments, increments, and unsets so a narrower spelling cannot
  silently escape it.

Adding workers would not release a per-session lock. Moving to a different
session store would introduce another dependency and change the concurrency
contract across the application for a problem demonstrated on four pages.
Reducing polling would hide some contention while making the interface less
current. None addresses the measured holder as directly as releasing it.

## Consequences

- **One slow request no longer owns the user's entire session lifetime.**
  The local reproduction demonstrates the mechanism; the wiring test guards
  the placement in the application. Neither is a production latency
  measurement, and I have not claimed a measured production improvement.
- **The lock was also an accidental mutex.** Releasing it permits overlapping
  requests from the same session. Operations that need serialization or
  idempotency must enforce those properties deliberately at their own
  boundary, rather than depend on a session-storage side effect.
- **The safe point needs maintenance.** A future helper that writes a session
  value after release changes the proof. The wiring test catches the source
  shapes it knows; it does not turn arbitrary PHP into a typed effect system.
- **Correctness tests and green dashboards can both miss the user's cost.**
  [ADR 0042](0042-read-the-union-view-inline-it-for-aggregates-lint-the-shape.md)
  found a volume-dependent cost behind correct results. Here the missing
  dimension was one session's concurrent requests. The aggregate monitoring
  of [ADR 0011](0011-instrumented-metrics-stack-over-bespoke-prober.md) remains
  useful, but it cannot replace a reproduction at the scope of the report.

## When I'd revisit

If many request paths need early release, I would make the session lifecycle
an explicit application boundary rather than keep adding page-local calls.
If the application needs concurrent session mutations, closing the file early
is no longer enough: that needs a deliberate merge or serialization policy.
The immediate verification still owed is a served application check with a
slow operation and a second tab polling, followed by a production measurement
of that same per-session wait.
