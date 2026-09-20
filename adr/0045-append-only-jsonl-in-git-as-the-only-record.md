# ADR 0045 - An append-only JSONL file in git as the only record, over a database with a promised backup

**Status:** Accepted · in production (the sign-off record behind an internal requirements-tracking site read by a five-person project team; reverses a decision made fifteen days earlier)

## Context

A small internal site tracks which requirements of a project have been signed
off, by whom, against what evidence. The sign-offs are the record of who
approved what. Fifteen days before this decision, I chose to keep them in
SQLite only, trading off-box durability and tamper-evidence for simplicity,
and named the mitigation that made the trade acceptable: the store would get a
backup entry alongside the host's other stores.

That backup was never built. On the day I checked, no timer and no cron job on
the host touched that directory at all. The record of who approved a phase of
the project sat on one virtual machine with no copy anywhere. That is not the
position the earlier decision argued for. It is that position minus its own
mitigation, and that fact reopened the question.

Reopened, the decision did not survive on its merits either. Its three reasons
were commit noise, two sinks disagreeing, and keeping one filtering
implementation in SQL. A handful of signatures a month is not noise. Two sinks
cannot disagree if there is no second sink. And the third described machinery
that did not exist: the reader was a `SELECT` of every column and every row
with no `WHERE`, and every derivation credited to SQL was computed in Python.
The query-ability the store was kept for had never been used.

[ADR 0008](0008-embedded-sqlite-over-networked-db-for-tooling.md) still holds
for single-node tooling state. This is the case it does not cover: state that
one process owns but that has to be durable off the box and evident if
altered.

## Decision

Sign-offs are recorded as newline-delimited JSON in the repository and nowhere
else. The database is dropped as the store, not demoted to a second copy.

- **Append-only in form, not only by rule.** Every line carries an explicit
  `id` and a `supersedes` naming the line it replaces. A supersede is a new
  line; a withdrawal is a new line; an existing line is never touched. The only
  legitimate diff is lines added at the end, so any diff touching an existing
  line is an anomaly visible in `git log -p`. The commits are signed, so an
  appended line arriving under an unsigned commit is loud too.
- **Supersession is explicit, never derived from line order**, because the
  files carry `merge=union`, which can interleave lines from two branches into
  an order neither branch had.
- **The write path is dumb at the point of the write.** The intake appends a
  line and returns. The append *is* the acknowledgement, so no signer ever
  waits on the code host's uptime.
- **A systemd path unit commits and pushes**, from a dedicated worktree pinned
  to the main branch - dedicated because the shared checkout holds other
  worktrees and whatever anyone has staged. It is a real unit so that
  `OnFailure=` pages me; a detached child of a web request pages nobody.
- **The generator closes the hole from the other end.** `OnFailure` needs the
  unit to run, and a path unit that was never enabled fails by not happening.
  So the site generator asserts the on-disk record matches the remote main
  branch, and it **publishes before it fails**: the page goes out, the run
  exits non-zero, the alert is sent. The nightly run makes that a daily
  heartbeat over the whole mechanism.
- **Who may approve is not in the record.** It is committed configuration,
  changed by pull request, because it is a decision rather than an event.

## Consequences

- **Tamper-evidence comes from the shape of the file** rather than from the
  discipline of the writer. A backup would have restored durability and never
  this.
- **Between the append and the push, durability is one machine.** The window is
  seconds normally and unbounded while the condition the generator asserts on
  is active, which is why that assertion exists.
- **A signature is visible on the page before it is on the code host**, because
  the generator reads the working tree. The signer needs to see their own
  signature on the next refresh, and the file has one writer and one branch.
- **Rejected:** keeping the database and building the backup (restores
  durability, not tamper-evidence); a database plus a derived JSONL export (two
  representations and a reader who must be told which to trust); one file with
  a type field (the schemas genuinely differ).

## When I'd revisit

If the record outgrows what a file scan inside a web request can serve, if it
ever needs a query no reader can do in Python, or if appending to a repository
from a service turns out to be a recurring operational failure rather than a
one-time setup. Not for commit volume: that was weighed and withdrawn. A
reversal also drops the tamper-evidence, so it needs a reason of that size.
