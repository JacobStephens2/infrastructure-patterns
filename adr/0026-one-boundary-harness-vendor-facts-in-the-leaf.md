# ADR 0026 - The agent is a substitutable command: one boundary harness, vendor facts in a leaf

**Status:** Accepted · in production (two vendor leaves; structural properties asserted under both)

## Context

Two CLI coding agents were candidates for the unattended loop
([ADR 0023](0023-attendedness-is-a-fourth-trust-axis.md)). One was natively
supported by the microVM tool, with proxy credential injection. The other was
the preferred agent for unattended work, absent from the tool's supported
list, and authenticating through an auto-refreshing browser-login token that
had to be copied inside. Choosing one would have made the loop a claim about a
vendor. Both accept the same shape - a single-turn prompt flag, an
accept-edits permission mode, a native turn bound - and the loop is a shell
loop around one headless call.

Building the second adapter after the first duplicated the whole boundary
lifecycle: sandbox creation and cleanup trap, read-only mounts, credential
placement, metered-key refusal, turn-bound detection. Two copies of structure
is where a third vendor's arrival produces drift.

## Decision

- **The agent invocation is one substitutable command.** Same for the box
  source (local or over SSH) and the notification surface: each is a script
  path honoring a fixed contract, driven by one shared test suite so no
  implementation can drift from what the dispatcher expects.
- **One boundary harness owns the structural lifecycle:** preflight that the
  sandbox tool exists, metered-key refusal *before* a boundary is built,
  unique sandbox naming with an `EXIT INT TERM` cleanup trap, read-only mount
  of the loop's own scripts, workspace mount, guest creation from the declared
  template, file staging into the guest, transcript capture with `pipefail`
  off during the agent run so a non-zero exit does not lose the transcript,
  and turn-bound exit mapping.
- **A vendor leaf declares only what its vendor does differently:** the
  metered-key environment names that supersede a subscription, the guest
  template and creation arguments, a credential presence check, guest
  preparation (install if unbundled, credential placement), the invocation
  arguments (telemetry off, permission bypass), the turn-bound message to
  match in the transcript, and credential-expiry extraction.
- **A property observed under one agent belongs to that agent until two have
  shown it.** Structural properties are asserted in *both* leaves' suites on
  purpose; mutation tests for the structure live against the harness, and each
  leaf keeps only the mutations for the facts it declares.

## Consequences

- **Running the same task under both agents says something about the
  technique rather than about one vendor**, which is the point of the
  experiment.
- **Adding a third agent is writing a leaf.** Contract options, cleanup,
  staging, and error handling are not re-implemented.
- **Some claims stopped being claims.** "Credentials never enter the VM" held
  for one vendor under proxy injection and not for the other. Naming the agent
  as a variable forced the honest statement: the microVM, the separate kernel,
  and the egress proxy hold for both; credential injection is a per-leaf fact
  ([ADR 0025](0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md)).
- **A hazard the leaf has to own:** one vendor's metered API key silently takes
  precedence over its subscription login. A bare key reaching the box moves
  billing to a metered route with no error. That is why metered-key refusal is
  harness-level and the *names* are leaf-level.

## When I'd revisit

If the vendors' headless contracts diverge (one loses the turn bound, one
requires a long-lived daemon), the "same shape" premise breaks and the harness
grows a second mode or one vendor leaves. The test for whether the seam is
still right: can a structural fix land in one file?
