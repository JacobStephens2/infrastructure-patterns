# ADR 0059 - Two processes, one release; refuse when they disagree

**Status:** Accepted · in production (the operations console and its production deployment worker, paired after an incident on 2026-10-15)

## Context

A release boundary follows shared code and state, not the number of processes.
The operations console gained a deployment worker so a production release could
outlive its browser connection. The worker shared a deployment module and the
history database schema with the console. They were one service split across
two systemd units.

The deployment policy had named the console alone as the exception to the
shared serving checkout in
[ADR 0029](0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md).
The console ran an immutable release; the new worker was installed on the
shared checkout, which kept fast-forwarding independently. The older console
still executed production deploys inside its HTTP request. The newer worker
saw the same operation as unclaimed and recovered it.

Production deployment ran twice. The worker's attempt shipped; the console's
attempt hit the production lock and showed the operator a failure for a release
that succeeded. Both wrote events into the same operation record. Serialization
stopped simultaneous execution, but it could not make two incompatible runners
agree about who owned the operation or how to report it.

The source record identifies its own part in the incident: listing the console
by name was a likely reason the worker missed the exception. The repair needed
a rule that covered the pair and a check that refused an incomplete rollout.

## Decision

Deploy the console and its worker as one immutable release. Enforce the pairing
both when configuration is applied and when production work is requested.

- **One release pin writes both drop-ins.** Configuration management derives
  each unit's working directory, launch command, and pre-start command from
  the same declared release. A second independently maintained pin would make
  disagreement a valid configuration again.
- **Refuse an unbuilt release before changing the units.** Check that every
  file either process executes is present, including its runtime environment.
  Naming a commit is not proof that the checkout can start. A failed assertion
  stops the converge before it writes either release drop-in.
- **Coordinate restart with the work already running.** The console restart
  holds the production deployment lock and waits for an in-progress operation
  to finish. A wait beyond 45 minutes fails the converge rather than restarting
  through the operation. The worker's stop also waits for production work to
  finish. Keep the previous release and prior drop-ins until verification.
- **Compare loaded revisions, not the checkout's current contents.** Each
  process records its revision at startup. A checkout can move underneath a
  running process; reading its current branch later would identify the files
  on disk, not the code the process loaded.
- **Prove worker presence with a held lock.** The worker publishes its revision
  and claim identity in the deployment database, but that row is not its
  liveness proof. It also holds a lock for its lifetime. The kernel releases
  the lock however the process ends, so a stale row cannot impersonate a live
  worker.
- **Refuse production work when the pair cannot be proved.** Differing
  revisions, an unidentified revision, or no reporting live worker prevents a
  new request from being recorded or taking the production lock. The deploy
  page shows the same condition. Automatic callers receive a retryable busy
  result while a release switch completes; an already accepted request still
  returns its existing operation.

## Consequences

- **A partial rollout becomes visible refusal.** The console does not accept
  production work on the assumption that the other process probably matches.
  An operator must finish the pair's rollout before deploying the product.
  That availability cost is intentional.
- **The lock and the revision answer different questions.** Presence proves a
  worker exists; a matching revision proves it speaks the same deployment
  protocol. Neither substitutes for the other, and a history row proves neither
  on its own.
- **Configuration and runtime checks cover different drift.** A converge
  restores a changed release pin, while the running console refuses a mismatch
  before the next converge. A correct declaration alone cannot prove which code
  two existing processes loaded.
- **This is not atomic symlink promotion.**
  [ADR 0030](0030-immutable-releases-atomic-promotion-append-only-journal.md)
  describes a separate application's promoter and journal. This console uses
  templated service drop-ins, coordinated restarts, and a runtime pairing gate.
  The earlier cross-reference in ADR 0029 conflated two release mechanisms.

## When I'd revisit

If the worker and console get a versioned protocol and independently compatible
state migrations, separate releases may become a useful feature. Until then,
shared code and schema make them one release. Before adding another process,
ask which release boundary it belongs to and extend the rule and its proof;
do not add another exception identified only by its current name.
