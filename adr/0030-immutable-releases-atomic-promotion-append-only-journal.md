# ADR 0030 - Immutable per-commit releases with atomic promotion and an append-only journal; re-promotion is a named attended operation; root-pinned authority drift is reported, never a failure

**Status:** Accepted · in production (an internet-facing service promoted automatically on human merge)

## Context

[ADR 0004](0004-shell-deploy-over-hosted-ci-runner.md) chose a guarded shell
deploy. This service raised the bar: a merge to main should reach production
within a minute without a human at a terminal, every switch must be
verifiable and reversible, and the promotion path must not be able to expand
root's authority on the host - because the same host runs a model-executing
subagent under systemd hardening and AppArmor profiles that root pinned on
purpose ([ADR 0035](0035-sandbox-namespaces-under-systemd-hardening-prove-from-the-live-unit.md)).

Two later situations tested the shape. A merge had reached production before
the post-promotion appearance verifier existed, and could never be verified,
because the promoter is idempotent (a commit already serving switches nothing)
and "unchanged" is measured against the release served *before* the switch.
And every release carries unit files and profiles that automatic promotion
must not apply.

## Decision

- **Each merge commit becomes an immutable release directory**; a `current`
  symlink is switched atomically by a promoter that preflights, switches,
  health-verifies, and rolls back on failure. Every attempt - including the
  ones that changed nothing - is a row in an **append-only promotion journal**
  that records what replaced what.
- **Promotion is idempotent** so a duplicate webhook delivery and the
  reconciliation timer are both safe: a commit already serving returns the
  recorded result and deploys nothing.
- **Re-promotion is a separately named, attended operation**, not a flag on
  promotion. It steps production back to the release the merge replaced (read
  from the journal, never guessed from "newest other directory on disk"),
  promotes the merge again through the same promoter, and records both moves.
  It refuses unless the commit is a verified human merge, is what production
  serves right now, has a journaled predecessor, and that predecessor is still
  on disk. The operator is told the window during which the older release will
  serve, a third of it is reserved for the restore that ends a failed run, and
  the deadline is enforced as *must switch before*, never as a signal that
  could cut a promotion in half - one killed between switching and journaling
  leaves production somewhere the journal does not know about, which is worse
  than overrunning. Nothing in the webhook path or the timer can reach it.
- **Hand-editing the symlink is the thing the design refuses.** It leaves no
  attempt, no evidence, no rollback target, and the state production was in
  exists only in the operator's memory.
- **Automatic promotion never replaces root-pinned deployment authority** -
  orchestration scripts, unit definitions, AppArmor profiles. Every attempt
  compares the release left serving against the pinned authority and records
  the diverging paths, naming the attended upgrade script as the action that
  applies them. **Drift is a normal state:** it does not fail the attempt,
  count toward consecutive failures, or open the circuit breaker. It is
  reported through the promotion metrics and the attempt's evidence record, so
  an owner can tell a fully live release from one that is live except for its
  root-pinned parts without a root terminal.

## Consequences

- **No exit leaves production unnamed.** A failed candidate restores the
  retained release, then the re-promotion restores the merge commit through
  the promoter - another recorded, health-verified attempt. Every exit that is
  not a completed verification says which release is serving and whether it is
  answering.
- **A merge whose predecessor has been pruned cannot be re-verified**, and the
  honest answer is to verify the next human merge instead. The retention count
  decides how long the window stays open.
- **The recommended path is usually not re-promotion.** Activate the verifier
  and let the next real merge prove it end to end: no new code, production
  moves once instead of twice.
- **Changing a unit or a profile reaches the host only through the attended
  upgrade** from a merged, promoted release. Copying the unit by hand is not
  the remedy; neither is loosening the kernel setting the profile depends on.

## When I'd revisit

If a second service on the host needs the same shape, the promoter, journal,
and drift report become a shared tool with per-service configuration rather
than a second copy. If the pinned authority ever needs to change more often
than releases do, the attended upgrade is too slow and the boundary between
"what a merge may change" and "what root must apply" needs redrawing in an
ADR, not in a script.
