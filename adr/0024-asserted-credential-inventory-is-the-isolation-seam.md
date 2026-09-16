# ADR 0024 - A short, script-asserted credential inventory on the agent box; the inventory, not the network hop, is the isolation seam

**Status:** Accepted · in production (inventory asserted before every dispatch; single-host mode gated on it)

## Context

[ADR 0023](0023-attendedness-is-a-fourth-trust-axis.md) put unattended agent
iterations in a microVM on a dedicated box, separate from the orchestration
host that holds fleet reach. The separation is only meaningful if the box
holds almost nothing - and "almost nothing" has to be enumerable, or every
isolation argument that rests on it is a hope.

The first spec said the box holds *three* credentials. It held four: the
microVM tool refuses to build a sandbox without a container-registry identity.
A count that has to be remembered as "three, plus one nobody mentions" is not
an inventory.

Two later pressures tested the seam. The loop needed to *tell* the operator
when a run finished - every good notification surface (mail, SMS, chat webhook)
costs a host on the egress allowlist and a credential on the box. And a
one-machine operator wanted to skip the second box entirely.

## Decision

- **The box holds three base credentials plus one repository-scoped token per
  target, and nothing else.** A dedicated SSH signing key registered to the
  operator's account; a *read-only* container-registry token; the model
  credential ([ADR 0025](0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md));
  and, per target repository, one fine-grained token with pull-request write
  and no issues permission, owner-readable only. No vault token, no database
  credential, no fleet SSH key, no cloud-provider token, no metered API key.
- **A script asserts the inventory in both directions** before every dispatch:
  the credentials the box must hold (and that they are *valid*, not merely
  present - `[expired]` is reported apart from `[absent]` because the remedy
  differs), and the credential *families* it must not hold, searched in the
  environment, shell profiles, and config files. Anything on the box that is
  not one of the allowed set is either a violation the script names or a gap in
  the script; both get fixed rather than discovered mid-run.
- **The credential the iteration never holds is the repository token.** The
  agent commits inside the boundary; the push and the draft pull request
  happen on the host after every agent process is gone. A leaked microVM cannot
  push.
- **The signing key is on the box knowingly.** A "Verified" badge on a loop
  commit means *the operator caused this*, not *the operator typed this*. The
  key has its own title so which key signed is the discriminator; it revokes
  without touching the laptop key; and branch protection requiring one human
  review is the compensating control for a compromised box producing verified
  commits in the operator's name.
- **The notification surface lives at the scheduler, not on the box.** A
  finished run comments on its own pull request (a surface the repository token
  already reaches). Email for failure-shaped events - a run that ended without
  a proposal, a dispatch or preflight failure, an approaching credential expiry
  - is sent from the scheduler side, which already observes every outcome and
  already holds mail credentials. The box's whole external reach stays "the
  repository."
- **Single-host mode is gated by the same assertion.** The scheduler may
  dispatch runs on its own machine only while that machine passes the exact
  inventory check the dedicated box passes. The seam was never physical
  distance; it was credential blast radius. A machine with production reach
  fails the check and cannot dispatch locally - by construction, not by
  documentation.

## Consequences

- **The inventory is the spec.** Adding a fifth credential is a decision that
  has to be written into the assertion, which is where it becomes visible.
  Revoking the registry token stops the boundary rather than degrading it - the
  right failure direction for a credential whose only job is letting a boundary
  start.
- **Two lists whose value is being short.** The credential inventory and the
  egress allowlist are the two things every "just add X" request reopens. The
  mail-credential-on-the-box option would have covered exactly one failure
  (run and scheduler dying together) at the price of both lists.
- **"Passes the ticket" and "passes the assertion" are different statements.**
  A box whose registry session has lapsed satisfies every acceptance criterion
  and would start a run with no Execution Boundary. The script grades the box
  *for a run*, which is stricter.
- **Success notifications now depend on the scheduler being up**, where a
  pull-request comment did not. The scheduler's own liveness is already
  alarmed, and a missed success email is the low-stakes miss - the proposal
  itself waits on the code host regardless.

## When I'd revisit

If the box ever needs to reach a second external system (a deploy target, a
package registry with push), that is a second inventory line and a second
egress entry, decided in an ADR, not a convenience. If the code host's
account-level notification settings change shape, the "comment on your own
PR" carrier is the first thing to re-test - it failed once already when an
account-global "notify me of my own updates" setting flooded every agent
session's activity into one inbox.
