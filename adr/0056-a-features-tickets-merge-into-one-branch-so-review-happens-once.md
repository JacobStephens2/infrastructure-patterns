# ADR 0056 - A feature's tickets merge into one branch so review happens once

**Status:** Accepted · in production (thirdshift, the open-source issue-to-pull-request factory that superseded Tracewake; feature runs on my own repositories)

**Source:** [thirdshift](https://github.com/JacobStephens2/thirdshift), a public repository. The original record is ADR 0006 under its [`docs/adr/`](https://github.com/JacobStephens2/thirdshift/tree/main/docs/adr), beside the code it governs.

## Context

I batch a feature's tickets into one branch so the human-review path asks for
one review of the feature. Reviewing every ticket makes the dependency graph
wait for me after every merge. Merging each ticket straight to the main
branch removes that wait and leaves a half-built feature there when the next
ticket fails.

[ADR 0036](0036-review-capacity-over-a-daily-spend-cap-for-unattended-dispatch.md)
bounded dispatch by review capacity. This is the other lever: change what
one review covers. The units still matter. A ticket is a bounded piece of
work; a feature is the behavior those pieces must produce together. Passing
each ticket's review does not prove the pieces agree at their seams.

The implementation needed concurrency without turning the orchestration
into another agent session. Whether a blocker has closed, a child failed, or
a pull request landed is structured state. I do not need a model to decide
which ticket the dependency graph permits next.

## Decision

Each feature gets a shared branch. Its tickets run in dependency order,
with independent tickets running up to 3 at once by default. Each is a
complete child thirdshift process, with its own ordinary run, repair loop,
and failure path, merging into the feature branch rather than the main
branch. No human review is required between those intermediate landings.

- **The parent reads the graph and outcomes.** Whenever a ticket ends, it
  reads the tracker again, checks dependencies, and starts eligible tickets
  until the concurrency limit is reached. Exit codes and pull-request URLs
  report what happened; an agent's summary does not decide what landed.
- **The feature pull request opens while work is incomplete.** Its draft
  checklist says which tickets landed and which failed, are blocked, or need
  human work. A failed ticket stops its dependents; independent work can
  still finish. A partial feature stays a draft rather than becoming a
  partially shipped main branch.
- **The whole branch receives a feature-level review.** Once every ticket is
  done, an agent reviews the accumulated branch against the feature, then
  the normal conflict and CI repair loop runs. The human-review path leaves
  one pull request ready for a person. The tool also supports an explicitly
  requested merge of that final pull request; this record does not claim
  that every feature receives human review.
- **Restart means continuation.** The next invocation picks up the shared
  branch and failed tickets' existing branches instead of discarding their
  work or creating a second feature pull request.

Threads inside the parent were rejected because interrupt handling and
progress output are process-wide. Child processes preserve the standalone
run's behavior, including its failure path, and a child crash does not take
down its siblings. Serial tickets remain available by lowering the limit.

## Consequences

- **Review capacity buys a feature instead of a ticket.** In the source's
  notes, about half of the 30 Spec reviews fixed a behavior bug the ticket
  reviews had passed. That count comes from session summaries, with a
  checked example; it is not an independently graded defect study. The
  feature review sees interactions the individual tickets never saw.
- **Closed is earlier than shipped.** A ticket closes when it lands on the
  shared branch, before its work reaches the main branch. Rejecting the
  feature pull request means reopening its tickets by hand. Tracker closure
  alone is therefore not evidence that a feature is available to users.
- **Branch-targeted CI is a real dependency.** If a repository runs CI only
  for pull requests into its default branch, intermediate ticket pull
  requests have no CI. The merge loop treats absent checks as green. This
  design does not manufacture test coverage the workflow did not run.
- **Concurrency buys speed at the price of repairs.** Independent tickets can
  still edit the same files. A later run merges the moved base and hands a
  conflict to repair; parallelism does not make collisions disappear.

[ADR 0040](0040-serial-subagent-rounds-over-detached-parallel-processes.md)
rejected detached CLI processes for rounds within an agent-led workflow.
Here a deterministic parent owns bounded ticket processes and their
outcomes. That is a different lifecycle, with explicit dependency and
continuation rules; it does not reverse that workflow's operational result.

## When I'd revisit

If a feature becomes too large for one useful review, I would split the
feature before increasing concurrency. If conflict repair dominates the
work saved, the parallel limit comes down. If intermediate branches need
the same CI evidence as the main branch, the workflows must run on those
branches before I treat their merges as tested work.
