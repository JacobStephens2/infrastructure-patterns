# ADR 0029 - Pin the shared serving checkout fast-forward-only, refuse-and-alert on a dirty tree, and edit only in worktrees

**Status:** Accepted · in production (shared serving checkout; operator default amended 2026-09-21 and release exception amended 2026-10-15)

## Context

At adoption, one orchestration host ran 20 systemd units straight out of a
single shared git checkout, group-writable because three identities (two
operators and a service account) work there and because publishing a static
site writes into a directory inside it. The same tree was where operators and
agents edited.

In one day that produced four incidents of the same shape: a file written into
the tree and left uncommitted while the main branch moved past it, then
committed later with a fresh timestamp - so git records the *oldest* content
as the *newest* change to that path. Two were caught only because a split pull
request forced a cherry-pick; a straight merge would have reverted 302
lines of a service back to an older algorithm. Two more were caught
only because `git pull` refused on a dirty tree. The usual signal is inverted:
the commit is newest and the content is oldest, so reviewing by commit date
confirms exactly the wrong thing, and no conflict ever surfaces. Separately,
the one service that ran with no deploy step at all served an unmerged branch
for an extended period, because "restart and it's live" is also "check out a
branch and it's live."

The obvious proposal was a *new* pinned clone for the units, leaving the shared
tree as the editing tree. That rewrites 19 unit paths and relabels a
whole new tree, to arrive where the fleet had already mostly gone on its own:
per-operator worktrees and per-feature worktrees had been created the day of
the incidents.

## Decision

- **The existing shared checkout becomes the serving checkout**, permanently
  pinned to the remote main branch by a timer. Every operator and agent edits
  in a worktree off it. No unit path changes; no SELinux context changes.
- **The pin fast-forwards only.** It never merges and never resets, so it can
  arrive at a state it refuses to fix but can never destroy work.
- **It refuses on a dirty tree and alerts.** Uncommitted content in the serving
  tree is an error condition to be reported - the signal that was entirely
  missing - not something to stash or reset. A scheduled `reset --hard` in a
  group-writable tree where three identities hold files is its own way to lose
  a day.
- **Alerting de-duplicates on the transition into the blocked state.** A check
  that pages hourly until someone clears it gets muted, and a muted check is
  the same as no check.
- **A pre-commit hook, installed once for all worktrees via `core.hooksPath`,
  blocks a commit whose staged path has moved on the remote main branch since
  the branch point.** It does not fetch - a network call on every commit is how
  hooks get disabled - it trusts the ref the pin timer keeps fresh and reports
  how stale that ref is when it trips. It trips on all four incident files.
- **The original operator default landed in per-operator worktrees.** This
  was reversed on 2026-09-21; interactive sessions again start in the shared
  checkout. Editing in a worktree remains the rule, not the shell default.
- **The operations console and its deployment worker stay out together**, on
  one immutable release. Configuration management writes both service
  drop-ins from one release pin and coordinates restarts with production work.
  A pinned shared tree cannot roll them back independently of the other units.

## Consequences

- **The pin is a detector, not a barrier.** Nothing at the filesystem level can
  stop editing in the serving tree, because publishing writes into it and
  nested checkouts are written in place. The stale-path pre-commit hook covers
  that failure mode in both the serving checkout and editing worktrees. A
  shell landing in the serving checkout still makes unfinished edits there
  possible; the pin detects that dirt rather than preventing it.
- **The no-deploy service lost its no-deploy property**, and that was accepted
  rather than worked around: its changes now merge like everything else, with a
  staging instance on loopback covering the fast-iteration need.
- **"Dirty" needs no special-casing.** Ignored directories (vendored trees,
  backups, virtualenvs, the worktrees themselves) already make
  `git status --porcelain` clean while `--ignored` shows dozens of entries.

## Amendment - 2026-09-21

The per-operator landing default was reversed. The pin and stale-path hook
remain; neither makes the serving checkout unwritable. The original claim
that the default worktree covered that gap no longer holds.

## Amendment - 2026-10-15

The release exception was originally named only for the console. Its worker
shares code and a database schema, so both must run the same immutable release.
Naming only one process helped the second process miss the exception.
[ADR 0059](0059-two-processes-one-release-refuse-when-they-disagree.md) records
the resulting release rule and refusal when the revisions disagree.

The original pointer to
[ADR 0030](0030-immutable-releases-atomic-promotion-append-only-journal.md)
was also the wrong mechanism: that separate application's promoter switches an
atomic symlink and journals attempts. This console switches through templated
service drop-ins and coordinated restarts.

## When I'd revisit

If the units ever need to roll forward or back independently, the shared tree
is the wrong unit of deployment and each service gets the per-commit release
shape of ADR 0030. If a fourth identity starts writing into the tree, the
hook is the first thing to check is installed for it, and the editing-worktree
rule must be made explicit rather than inferred from its login directory.
