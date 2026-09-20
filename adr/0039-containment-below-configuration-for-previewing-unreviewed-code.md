# ADR 0039 - Preview unreviewed code on the credentialed host, with containment below configuration

**Status:** Accepted · in production (a second instance of Tracewake's web window, serving unmerged branches)

**Source:** [Tracewake](https://github.com/JacobStephens2/tracewake), a public repository. The original record is ADR 0016 under its [`docs/adr/`](https://github.com/JacobStephens2/tracewake/tree/main/docs/adr), beside the code it governs. This is the generalized write-up.

## Context

The loop's web window was served from the shared, pinned checkout
([ADR 0029](0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md)),
so the only way to see a branch's page was to merge it first. That is backwards
for exactly the changes where looking *is* the review.

The obvious fix is a second instance serving an unmerged branch. It needed a
ruling before a build, because the loop's own spec says no model output
executes on the host that holds production credentials, and a previewed branch
may well be model output - a proposal branch is what the loop produces.

[ADR 0023](0023-attendedness-is-a-fourth-trust-axis.md) answers it. That
prohibition was never about the bytes. It is about the premise "I notice and
fix", which fails for an unattended run because such a run is defined by nobody
noticing for thirty to forty-five minutes. A preview is the opposite case: I
started it, I am looking at it, and the failure mode is a page rendering wrong.
Attendedness holds, so the code may run here. The thing is called an **attended
preview**, and the name carries the reason, because its failure mode is someone
leaving one running until it is no longer attended.

## Decision

- **The ruling licenses rendering, not reach.** A preview runs the real cycle
  and dispatch code end to end against a real database with real triggers and
  notifications, with the tracker and the agent box faked at the edge. Letting
  a preview dispatch for real was rejected on this ADR's own logic: I would be
  attended for the dispatch and absent for the run that follows.
- **The database grant is the control; the connection string is just how it
  works.** Pointing the preview at a staging journal is one environment line.
  That line is configuration, and the code being previewed is precisely the
  code that might not honor it. So the preview runs as a dedicated runtime
  account that holds `CONNECT` on the staging database and none on the live
  one. A branch with the live database name hardcoded gets a permission error,
  not a permanent row in the append-only record whose job is answering "why
  did the loop do that?"
- **The same account holds no SSH key and no vault environment.** The dispatch
  module is importable from the web app by design, so the import cannot be
  removed and containment has to sit below it.
- **The unit enumerates its environment explicitly** rather than reading an
  environment file, so a later edit to a shared file cannot hand it
  credentials.
- **The account is a runtime identity, not an owner.** The preview worktree
  stays owned by the operator account; the preview account has read and
  execute only. Making it the owner would need a sudo rule per checkout, and an
  agent that can become that account has a route around the grant the design
  rests on.
- **Its own hostname, not a path under the live one.** A path prefix is
  workable and loses on same-origin: it hands code I have not read the live
  app's session cookies.

## Consequences

- I compare a branch's page against the live one with both reachable at once,
  and the page says which one I am looking at.
- The design tolerates the previewed code being wrong about its own
  configuration, which is the case a preview exists for.
- There is a second instance to forget about. The name is the mitigation, and
  it is a weak one.

## When I'd revisit

If previews need to exercise a real dispatch, they move inside the execution
boundary like any other unattended run; the host-side preview never grows that
ability. If forgotten previews become a pattern, the unit gets a runtime limit
and stops itself.
