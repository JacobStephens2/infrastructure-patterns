# ADR 0055 - Decide CI outcomes from structured state, not the agent's account

**Status:** Accepted · in production in thirdshift, the open-source issue-to-pull-request factory that superseded Tracewake (used on my own repositories and the reservations platform's work tracker).

**Source:** [thirdshift](https://github.com/JacobStephens2/thirdshift), a public repository. The original records are ADR 0008 and ADR 0010 under its [`docs/adr/`](https://github.com/JacobStephens2/thirdshift/tree/main/docs/adr), beside the code they govern.

## Context

A red check needs a state transition, not an agent's explanation of why it is
red. Two failures in my own repositories made that distinction concrete.

First, a branch inherited broken CI from its base. The factory started a
repair session, which could find nothing on the branch to fix. Asking the
agent to report that the base was already red spent a session on a comparison
the tool could make itself. Ignoring the failure was worse: in one case that
check was the only compile step for the code being changed.

Second, a check failed for a reason that did not repeat. A repair correctly
made no commit, but the factory still saw the original red head and failed
the Run. A later marker commit went green on the same code. The useful
observation was that the head had not changed, not whether the repair called
the failure flaky.

These are different cases. The first needs the base fixed or updated; the
second earns one attempt to run the same checks again. Both decisions can be
made without reading an agent's prose or a CI log.

## Decision

**Compare inherited failures against the base commit the head actually
contains.** Before starting a CI-fix repair, read the failed head checks and
the checks on the base commit last merged into that head. Match by check name
and failed state. A failure already present there is inherited, not assigned
to the issue branch's repair.

Send any branch-owned failures through the ordinary repair path, without
asking that repair to fix inherited failures. When every failure is inherited,
merge a newer base commit if one exists and assess again. If the base has not
moved, fail the Run and name the base checks to fix. Do not mark a red pull
request ready, and do not merge past the failure. An
explicitly allowed Base fix may instead make a separate reviewed Merge run
into the base, after which the original Run checks again. That is a separate
repair of shared state, not permission to ignore red CI.

A missing, pending, or successful base check does not establish an inherited
failure. Do not trigger or wait for base CI to resolve that uncertainty. The
comparison is with that commit's available state, not the latest workflow run
on the base branch, which may describe another revision.

**An unchanged head after a CI-fix repair earns one check re-run.** If the
repair committed nothing and there is no base move to merge, request the
failed jobs of each GitHub Actions workflow run containing the branch's own
failed checks. Deduplicate by workflow run. Then watch the same head again.
Green continues delivery; another own failure ends the Run, without another
repair or re-run for that head.

Do not inspect the repair's conclusion or its CI notes. A changed head returns
to ordinary checking. A later head may earn its own re-run; the allowance is
per head, not an unbounded retry of a failing branch.

## Consequences

- **The comparison has a known blind spot.** The same check can fail for a
  different reason on the branch while already red on the base. Name and
  conclusion matching cannot tell. Nothing merges past that red state. If a
  Base fix lands, checking the branch again exposes any failure that remains.
- **A re-run must be a new attempt.** GitHub creates new check runs and lists
  the latest one for a name. Record the prior check-run identities and wait
  for replacements for successfully requested workflow runs. Seeing the old
  result is not watching the retry. A failed read or disappearing known
  failure cannot establish green.
- **A refused request can still have a useful current result.** The repair
  may already have re-run CI. Report GitHub's refusal, reread all checks on
  that head, and continue only from that state. If an earlier request
  succeeded before a later refusal, its new-attempt requirement still holds.
- **Workflow granularity has a cost.** An inherited failure sharing a workflow
  run with an own failure is re-run along with it. Inherited failures never
  trigger a re-run on their own. If an own failure is a commit status or
  another app's check rather than an Actions job, fail without requesting a
  partial re-run that cannot make the head green.
- **One retry spends CI time deliberately.** Re-running before every repair
  would delay real fixes. Re-running indefinitely would wait out a broken
  check. The unchanged-head rule buys one chance for a non-repeating failure
  after the repair has already had its opportunity.

The invariant is the same as
[ADR 0038](0038-guardrail-reads-every-unattended-tree-unknown-is-never-green.md):
unknown cannot be reported as green after known failure. As in
[ADR 0027](0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md), the
external dependency is read through a contract I can check, rather than made
the interface by copying its explanations.

## When I'd revisit

If check-name matching repeatedly misclassifies failures, add a structured
identity the CI producer can supply rather than parse log text. If transient
failures become common enough that the retry is the normal path, fix that CI
source. The bounded re-run is recovery behavior, not a substitute for a stable
check.
