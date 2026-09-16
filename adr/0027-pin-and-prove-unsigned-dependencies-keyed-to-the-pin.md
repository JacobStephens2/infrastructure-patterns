# ADR 0027 - Enroll an unsigned third-party executable by pinning the exact artifact and keying its acceptance proof to the pin

**Status:** Accepted · in production (an unsigned community IaC provider; a self-updating vendor agent runner)

## Context

Two dependencies arrived that could not be verified the normal way and could
not be avoided:

- **A community DNS provider plugin for the IaC tool.** No signed alternative
  exists; the registry cannot verify its signature; and it handles a few
  record shapes wrongly.
- **A vendor's CLI agent runner** used for bounded administrative delegations.
  It self-updates by default, holds a consumer subscription credential that any
  process able to read its auth store can spend, runs in an always-approve
  loop, and the vendor publishes no checksum, signature, or provenance.

"Review it once and trust the name" fails silently in both cases: a plugin
version bump or a runner self-update replaces the reviewed bytes with the
appearance of the reviewed bytes.

## Decision

- **Pin the exact artifact.** The provider is pinned to one version with the
  lockfile's checksums committed. The runner is pinned by reviewed version *and*
  SHA-256 digest, together with the single configuration source it may read,
  in a root-managed file; self-update is disabled by policy the runner itself
  enforces.
- **Prove the artifact, not the name.** The provider's acceptance is a full
  record-lifecycle test run in a sandbox zone. The runner's enrollment record
  is: an attended device authorization, one completed subscription-backed run,
  a probe that the sandbox reads nothing in the credential-custody boundary,
  a drill for each named failure ending in the state it must reach, and a stop
  drill that preserved work.
- **Key the proof to the pin.** Any change to the provider's source, version,
  or checksums - or a move to a fork - requires repeating the lifecycle test,
  and a check enforces that mechanically. Pinning a new runner build discards
  every proof belonging to the old one; the executor refuses real work until
  an accepted enrollment exists *for the exact pin installed*. An unreadable or
  absent record is an absent proof.
- **Never let the dependency be the interface.** The provider sits behind an
  adapter that generates every zone file and import from the live inventory
  and refuses the cases the pinned version handles wrongly, enumerated in its
  README. The runner sits behind an executor that re-reads the binary's
  digest, the runner's own self-report, and the pinned configuration before
  every accepted run, and pauses work on any drift: a self-update, a non-
  subscription auth route, an available API key, a different model, a changed
  sandbox profile, an extra configuration source, any plugin or MCP server, or
  a self-report the contract cannot parse at all.

## Consequences

- **A false pause is recoverable by review; a silently dropped boundary is
  not.** The drift check is deliberately unforgiving because it is cheap and
  because every boundary below it is stated in the configuration it validates.
- **The digest attests less than it looks like.** With no vendor provenance, a
  digest proves the runner has not changed since it was reviewed on this host
  and nothing about the download. Two independent fetch routes producing
  byte-identical binaries is the strongest corroboration available, and that is
  stated rather than implied.
- **Design against documentation, then correct against contact.** Half the
  runner's drift fields, read from a research note, had no counterpart in the
  binary's actual self-report. Enrollment is where field names get confirmed
  against the pinned artifact; a renamed field pauses work instead of dropping
  a boundary.
- **Separate identities for credential custody and model execution.** The
  runner's OAuth refresh credential is owned by one system user; the model
  process runs as another with an allowlisted environment and an ephemeral
  home, obtains a short-lived access token through a root-owned broker under
  a sudoers rule narrowed to one command, and restricted ptrace scope keeps a
  model-spawned shell from reading that token out of the runner's memory.

## When I'd revisit

The day either vendor publishes signed releases, the pin stays and the
lifecycle proof shrinks to "signature verifies plus the adapter's own tests."
If a pinned artifact's known-wrong cases grow past what an adapter can refuse
cleanly, that is the signal to fork or replace it, with the same proof
repeated against the replacement.
