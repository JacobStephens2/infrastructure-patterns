# ADR 0054 - Merge the exact head whose CI was watched, over platform auto-merge

**Status:** Accepted · in production in thirdshift, the open-source issue-to-pull-request factory (used on my own repositories and the reservations platform's work tracker; the self-merge history below is thirdshift's own public repository).

**Source:** [thirdshift](https://github.com/JacobStephens2/thirdshift), a public repository. The original record is ADR 0004 under its [`docs/adr/`](https://github.com/JacobStephens2/thirdshift/tree/main/docs/adr), beside the code it governs.

## Context

The commit I watched must be the commit I merge. Asking GitHub to merge a pull
request later does not preserve that relationship: another commit can arrive
after the factory's last review, and the platform can merge that later head.

thirdshift already has a loop that merges the base branch into an issue
branch, watches CI, and starts a repair session when the branch conflicts or
its checks fail. A Merge run asks that same loop to finish by merging the pull
request. The authoring agent proposes code and addresses review findings; the
tool decides whether delivery may proceed from structured repository state.

The self-merge history has a specific evidence boundary. My
[published study](https://stephens.page/blog/fresh-eyes-beat-a-second-family/paper/)
reports that no human had read a thirdshift pull request before it merged
since late September 2026. That statement concerns thirdshift's own repository,
not every repository where the tool runs. A target repository's review policy
still decides whether a Merge run can complete.

## Decision

Have the tool merge inside the delivery loop, using
`gh pr merge --merge --match-head-commit <sha>` on the head whose checks it
watched. Do not enable GitHub auto-merge, and do not delegate the final merge
decision to the authoring agent.

Before each attempt, read the pull request's structured review decision.
`REVIEW_REQUIRED` or `CHANGES_REQUESTED` ends the Run as a named review-policy
refusal, without a merge attempt or another repair. Otherwise the merge request
still has to satisfy GitHub's repository policy.

A moved base, new foreign commit, or failed check returns to the existing
loop. Merge the new base, have foreign commits reviewed, repair when needed,
and watch the resulting head again. A successful observation of one head
cannot authorize its successor.

If a merge fails with nothing left to repair - no new commits, an unchanged
base, a mergeable branch, and green checks - report a policy refusal. Do not
parse GitHub's error prose to decide whether the tool should invent another
code change. A policy refusal leaves the pull request ready for review; it is
not a failed implementation sent back to draft.

GitHub auto-merge was the plausible alternative, but it changes four contracts:

- It depends on repository settings and protection rules that the factory's
   target repositories do not all have.
- It waits for required checks. thirdshift watches all checks on the head,
   including ones the repository has not made required.
- It can merge a later head after the factory's last observation. Matching
   the head refuses that race rather than trusting the pull request's identity.
- It completes after the Run has ended. The Run then cannot repair a late
   conflict, report the merge through its exit status, or finish issue and
   branch cleanup as part of the observed result.

## Consequences

- **Merge is part of the operation.** A successful Merge run means the merge
  happened, not that a future platform action was armed. Cleanup and issue
  closure follow that result.
- **A refusal need not consume model work.** A required review is a policy
  decision, not an invitation for another repair session to find a code fix.
- **Commit identity is stronger than a pull-request reference.** The checked
  head can become stale between observation and mutation. The merge API's
  head match makes that a refusal the loop can handle.
- **This does not invent missing checks.** Initial absence of CI after the
  grace period is accepted as no CI. Pinning the head cannot certify a test
  that never ran. [ADR 0056](0056-a-features-tickets-merge-into-one-branch-so-review-happens-once.md)
  records the consequence for ticket branches.
- **I own the delivery loop.** Hosted auto-merge would be less machinery. The
  cost here is maintaining state checks, retry limits, interruption handling,
  and a meaningful final result. Deterministic CI handling is recorded in
  [ADR 0055](0055-decide-ci-outcomes-from-structured-state-not-the-agents-account.md).

## When I'd revisit

If the hosting platform can bind deferred merge to the exact reviewed head,
watch the same check set, and report a result the repair loop can still act
on, reconsider using it. If a repository requires human review, leave that
policy in force and use a proposal-only Run or obtain the required review.
