# ADR 0042 - Read the reconciling view by default, inline the union for aggregates, and lint the shape of the restriction

**Status:** Accepted · in production (the operations platform staff work in daily; amended after a production incident on 2026-08-25)

## Context

One kind of record was moved out of a large messages table into a table of its
own. The old rows were left in place as an exact backfilled copy, new rows were
written only to the new table, and a view reconciled the two: non-moved rows
from the old table `UNION ALL` rows from the new one, with a synthesized type
column so callers kept one column shape. The new table's auto-increment was
parked far above the old table's range so ids stay unique across both and a
lookup by id works whichever table it lands in. Dual-writing was rejected
because two writable sources of truth drift the first time one write fails.

The rule was: **anything that reads these records reads the view.** Reading the
old table directly returns an archive frozen at the cutover, and does so
silently - the rows are still there, so nothing errors and nothing looks empty.
That failure shipped twice. Two screens disagreed for weeks because one read
the base table and the other read the view.

Then the rule itself caused an incident. MySQL cannot push a predicate through
a `UNION` unless the predicate is a constant. A restriction that is a subquery
or a join predicate is applied only after the whole view is materialized, and
this view carries two large text columns. That was about 1.5 GB spilled to
disk on every load, however few rows the query wanted. On 2026-08-25, eleven
dashboard queries stood on the database at 493 to 1,441 seconds each and slowed
every page in the product with them.

## Decision

The rule gets a boundary, and the boundary is the **shape of the restriction**,
not the kind of query.

- **Constant or bound-placeholder restriction**: a single key, a literal `IN`
  list, a bound parameter. Pushdown works. **Read the view.** This is the
  common case: 22 call sites, all unchanged.
- **Restriction is a subquery or a join predicate**: pushdown is impossible.
  **Inline the union and apply the restriction inside each arm**, or distribute
  the join over the arms.
- **Restriction is not expressible at all**: the inlined union still stands in
  for the view, but projects only the columns the aggregate needs, so the temp
  table is a few megabytes in memory rather than 1.5 GB on disk.

An inlined arm must reproduce both halves of the view exactly, including the
type filter on the old table's arm. Drop that filter and every historical
record is counted twice, silently, because the rows are real and the totals
merely look larger - the same failure the view was created to prevent. That is
why the default stays "read the view" and the carve-out is written down rather
than left to judgment.

A unit test enforces the boundary. It fails on a join against the view, on a
subquery restriction of the view's key, and on the view's key being bound by a
join.

## Consequences

- The worst aggregate went from 1,441 seconds to 0.196 seconds once the union
  was inlined.
- **The test is a lint rule, not a behavioral test.** Nothing about the results
  was ever wrong, which is exactly why nothing caught this for two months.
  Correctness tests cannot see a cost that depends on volume.
- **The carve-out was not new, only unrecorded.** A comment in the original
  migration already said dashboard subqueries sum the two base tables directly
  for speed. The aggregates that caused the incident were added later, read the
  view, and were verified on a preview database that does not carry
  production's volume. Correctness was checked; volume-dependent cost was not.
- There are now two ways to read the same data, and the second one is
  dangerous. The lint is what makes that tolerable.

## When I'd revisit

When every reader of the frozen copy is gone, the backfilled rows can be
deleted and the view collapses to one table plus one arm, taking the double-count
hazard with it. If the engine gains predicate pushdown through unions for
non-constant restrictions, the carve-out becomes unnecessary and the lint
should be deleted rather than left to forbid something harmless.
