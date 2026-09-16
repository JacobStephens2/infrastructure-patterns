# ADR 0025 - The model credential inside the boundary: a long-lived subscription token injected by environment, over per-iteration renewal or a metered key

**Status:** Accepted · in production (supersedes an eight-hour session file renewed per iteration)

## Context

An unattended agent iteration ([ADR 0023](0023-attendedness-is-a-fourth-trust-axis.md))
has to authenticate to a model vendor from inside a microVM. Two properties
were wanted at once and turned out to trade against each other:

- **Credential isolation.** The microVM tool's host proxy can inject a
  *service secret* - an API key - so the key never enters the guest.
- **Cost control.** The loop bills against a flat subscription, deliberately: a
  metered key cannot be capped per run, so the termination contract (turn and
  time bounds) is the entire cost control, and a metered key present anywhere
  is treated as a fault.

A subscription login is an OAuth session file, not a key the proxy can present.
So the first build copied the session file into each iteration's guest. That
session expired eight hours after a human minted it, while the scheduler
dispatched around the clock - sixteen of every twenty-four hours it was
dispatching against a dead credential, and the failure surfaced only in one
run's progress log.

The interim fix renewed the session on the host at the start of every
iteration. It worked, and it cost a model process running on the host
*outside* the boundary, a network call inside every iteration's setup, and a
renewal that could exit zero having minted nothing.

## Decision

- **Use the vendor's long-lived setup token** (one-year lifetime), carried in an
  environment variable, resolved on the host and injected into the guest
  process's environment at launch. **No credential file crosses the
  boundary.**
- **Retire per-iteration renewal.** Zero model processes on the host; iteration
  setup makes no vendor call.
- **Refuse any metered key.** An iteration refuses to start if a metered API
  key for the vendor is present in the environment or on disk; the inventory
  script ([ADR 0024](0024-asserted-credential-inventory-is-the-isolation-seam.md))
  distinguishes an OAuth-backed service entry (allowed) from a key-backed one
  (violation).
- **Scan the diff before pushing.** A token in the guest's environment is a
  token an agent could write into a tracked file. The host-side propose step
  greps the branch diff for the vendor's token prefix and refuses to push -
  marking the proposal failed - if it matches. Deterministic, and before the
  remote ever sees it.
- **Mint all yearly credentials in one wizard**, print the shared expiry, show
  the nearest expiry on the operator's dashboard as an absolute instant (a
  remaining-time value read once a cycle would be wrong by however long the
  page sat open, in the reassuring direction), and email once, a fortnight
  ahead.

## Alternatives considered

- **Metered key via proxy injection.** Gives isolation, forfeits the cost
  control. The whole loop's economics assume a flat rate.
- **Refuse to dispatch on an expired session and page.** Honest and simple, and
  it drains no queue overnight while paging for something a machine can fix.
  Kept as the fallback if token minting ever proves unreliable.
- **Copy the refreshed session back out of the guest.** Refused outright: it is
  a hole in the boundary's one-way claim, and the thing it carries back is a
  live credential written by an unattended agent.
- **Reimplement the vendor's OAuth refresh.** A copy of an undocumented
  contract that breaks by minting nothing while reporting success.

## Consequences

- **Maintenance is annual**, and it is a wizard, not a runbook.
- **The credential is inside the boundary on purpose.** What bounds its
  exposure is the boundary and the credential's shape, not the proxy: egress is
  deny-all plus the code host and the vendor; the sandbox dies after each
  iteration; the token is the operator's own and revokes from the account
  without touching the other three credentials.
- **A residual worth knowing about.** Under the earlier session-file design the
  microVM tool's host proxy, which terminates TLS for the vendor's OAuth
  endpoint, intercepted the guest's token refresh and *took custody of the
  tokens on the host* - so state crossed the boundary outward, into a
  host-global secret store that any sandbox on that box would then be handed.
  It could not be prevented without giving up authentication, and it was
  accepted because what was captured was the operator's own subscription. The
  setup-token design removes the refresh and with it the capture, but the
  lesson stands: a sandbox tool's credential proxy is a second copy of the
  credential to reason about.

## When I'd revisit

If the vendor withdraws long-lived tokens, the choice is back to the paging
fallback versus renewal-on-host, and the renewal's costs above are the price
list. If a second vendor's CLI authenticates only by API key, that vendor gets
proxy injection and a *different* cost control, and the two configurations
differ on a second axis besides the model - which matters before any
comparison between them is drawn ([ADR 0026](0026-one-boundary-harness-vendor-facts-in-the-leaf.md)).
