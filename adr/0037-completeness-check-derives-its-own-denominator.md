# ADR 0037 - An agent's completeness check derives its own denominator and declares what it left out

**Status:** Accepted · in production (the acceptance check for the unattended loop's first real task, against a live product codebase)

## Context

The unattended loop's first task was a classification exercise: every
occurrence of one database table's name in application code had to be marked as
a read that should include a newer sibling table, a read that was correct as
written, or a write. A classification exercise has no test suite. Without
something mechanical built to be both, the run has no backpressure and I have
no acceptance criterion.

The ticket stated the size of the job: 78 files and 276 occurrences. That was
true the day it was written. Run against the main branch when the task was
picked up, the same search answered 359 occurrences across the tracked tree and
303 in application code. The codebase had moved.

A check that compared the agent's inventory to the number in the ticket would
therefore pass on an inventory that missed everything added since the ticket
was written - the exact failure it exists to catch.

## Decision

The check derives its denominator from the checkout on every run and never
reads a count from the task or from the inventory. `git grep` over tracked
files is the source, one matching line is one occurrence, and the match is
case-insensitive because SQL identifiers are.

A derived denominator is only honest if what was subtracted from it is visible:

- **Exclusions are declared in the script, not passed by the caller.** Schema
  files, documentation, and vendored code are listed in the check itself. A
  caller flag can add to that list and cannot remove from it, because a
  denominator whose exclusions come from the call site is one the caller can
  shrink until the inventory looks complete.
- **Scope is printed with the count it removed.** Narrowing a run to one area
  of the codebase is how a first run is sized; the report says how many
  occurrences that narrowing set aside.
- **A denominator of zero is an error.** A mistyped symbol, a wrong scope, a
  checkout that failed to clone: each produces a check with nothing to check,
  and each would otherwise report success. It exits 1.
- **A stale entry fails as loudly as a missing one.** An inventory line that no
  longer holds the symbol was written against an older tree, so its
  classification was never reviewed against what is there now.
- **The report names every unaccounted occurrence with its line.** "Six are
  missing" is a number; six paths and six lines are what the next iteration can
  act on without redoing the search.
- **A rationale has a floor.** Each entry must carry a reason, and without a
  minimum length a single character satisfies that. The floor is twelve
  characters, declared at the top of the script as a first guess whose
  correction is one line.

## Consequences

- **The same script is the run's backpressure and my acceptance check**, with
  no argument changed between the two roles.
- **It reaches nothing**: no network, no model, no write to the checkout. Under
  deny-all egress inside the execution boundary it behaves exactly as it does
  on my machine, so it cannot fail inside the boundary and pass outside it -
  the worst shape available to a component whose whole job is to be the honest
  signal.
- **Line granularity is coarse, in the safe direction.** A line naming the
  symbol twice is one entry, and an occurrence in a comment must be classified
  like any other. Both ask for more classification than strictly needed.
- **It is generic over the symbol.** The next audit of this shape does not
  write the mechanism again.

## When I'd revisit

If the unit of work stops being "a line that mentions a name" - a refactor
judged by call graph, or a migration judged by behavior - a text search is the
wrong denominator and the check wants a parser or a test suite. The rule
survives the change of tool: derive the total from the tree, and print what you
subtracted.
