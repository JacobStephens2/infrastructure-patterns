# ADR 0060 - A failed deploy pauses nothing, and recovery reads production

**Status:** Accepted · in production (the production deploy worker; restart recovery proved in process tests, not yet against a production interruption)

## Context

A failed release must not make the commit that fixes it wait for somebody to
clear a global pause. That was the policy chosen before automatic deployment
was built. Later default-branch commits remain eligible because one may contain
the fix. The price is that each operation must establish the state production
is actually in, rather than inherit permission from the operation before it.

A worker crash makes that distinction unavoidable. A record saying code deploy
started does not prove whether it finished. A record saying a migration started
does not prove its statements rolled back. Retrying everything can repeat work
that shipped; declaring every abandoned record interrupted leaves even a
completed deploy waiting for a human to settle its history.

[ADR 0058](0058-the-hosted-runner-asks-and-the-host-decides.md) makes the host the
owner of the operation. This decision defines what that owner does after an
ordinary failure and after the process owning it disappears. The two cases
must not become one unbounded retry loop.

## Decision

An ordinary deployment failure sets no global pause and does not automatically
retry the same commit. The next eligible commit may proceed. An interrupted
operation is settled first, under the production lock, from its durable record
and independent observations of production.

- **Re-establish eligibility for every automatic operation.** The deployment marker must
  match an independently probed live commit. The candidate must descend from
  that live commit and its exact required CI results must pass. Run the gate
  during selection and again before any stage, under the same lock hold.
  Unreadable checks or unexplained production drift do not inherit yesterday's
  permission.
- **Select by ancestry, not completion time.** Choose the newest eligible
  waiting commit on the default branch. Older requests it contains become
  superseded rather than deploying separately. An already-live or older
  request cannot rewind production. A newer red or pending commit does not
  displace an eligible green one merely because its workflow finished later.
- **Keep deliberate retries deliberate.** Once an automatic operation has
  reached production work, an ordinary failure does not make another delivery
  execute it again. A person can request a new manual operation. Operators
  also retain an explicit persisted pause for exceptional releases; a failure
  does not silently turn that control on.
- **Observe before recovering.** Take independent live probes around a read of
  the deployment marker, and refuse to settle while the host's deployment
  lock is held. Combine those observations with the recorded target, prior
  live commit, reported failure, completed steps, and retry allowance. Do not
  resume from a stage the worker might have reached.
- **Finalize work that demonstrably shipped.** When the code deploy exited
  successfully, nothing reported failure, and the target is live, repeat the
  health verification and marker finalization. Apply no migration and deploy
  no code. The finalization can still fail; live code identity is not proof of
  health.
- **Spend one restart retry in the claiming write.** An operation interrupted
  before or during code deployment may rerun the whole pipeline on its same
  record. The retry allowance is persisted in the same database write that
  claims it, before execution. Another worker or another restart cannot give
  that allowance back.
- **Never re-spend a human's CI override.** An interrupted operation that ran
  under an operator's override is not retried automatically. Only a person can
  make that judgment again. An explicit automation pause also prevents the
  restart retry, without spending it.
- **Represent uncertainty as a held state.** A held host lock, failed or
  disagreeing probes, or unreadable marker authority leaves recovery blocked.
  The worker checks again every minute and settles the operation when the
  condition clears. New automatic work waits; manual operation remains
  available. A later operation already reaching production, an exhausted
  retry, or unexplained drift closes the abandoned operation as interrupted
  instead of guessing.

## Consequences

- **Continuing after failure moves the safety burden to prerequisites.** A
  later fix can ship without somebody noticing and clearing a pause. It can
  also move production forward before anyone has understood the earlier
  failure. The live-state gate and the refusal of unexplained drift make that
  an explicit policy rather than optimism.
- **A retry is not a rollback.** An interrupted migration may have committed
  some statements without recording completion. Its retry runs the file
  again. A migration that cannot tolerate its own partial effects fails, and a
  later commit must correct it; the worker does not claim those effects were
  undone.
- **Reconciliation records identity, not success.** If the operation's own
  target is live but the marker still names its starting commit, agreeing
  probes and the durable record can explain that gap. The marker can be
  reconciled while the operation stays failed. Other drift is left untouched.
- **The proof boundary remains visible.** The normal worker has deployed to
  production. Restart recovery has been exercised by killing real worker
  subprocesses and their children during controlled tests, including
  interrupted migrations, repeated interruptions, and disagreeing probes.
  That is not yet evidence of recovery from a real production interruption.
- **Unknown still blocks.** This shares
  [ADR 0038](0038-guardrail-reads-every-unattended-tree-unknown-is-never-green.md)'s
  refusal to turn unreadable evidence green. It also shares
  [ADR 0030](0030-immutable-releases-atomic-promotion-append-only-journal.md)'s
  insistence on naming production after an attempt, while using independent
  probes and a recorded marker rather than that application's promoter.

## When I'd revisit

Revisit after the first real production recovery and compare its observed
sequence with the process tests. Revisit if transient failures repeatedly need
manual retries, but do not add an allowance that resets when the process does.
If migrations cannot tolerate partial execution, that must change the migration
contract before recovery can safely promise more.
