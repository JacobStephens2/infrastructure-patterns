# ADR 0027 - Accept an unsigned DNS provider behind an adapter, with proof keyed to the pin

**Status:** Accepted · in production (the infrastructure provider behind adopted, traffic-serving DNS zones)

## Context

An unsigned community DNS provider handles live infrastructure, so its name is
not enough to trust a replacement artifact. The registry cannot verify its
signature, no signed alternative exists, and the provider handles some record
shapes incorrectly. Rejecting it would leave this DNS workflow without a
provider; accepting arbitrary later versions would discard the evidence that
made the current one acceptable.

The choice is supported by a real adoption path. Existing DNS records are
imported into declarative ownership, then changes enter through a reviewed
plan and an operator-confirmed apply. A provider error can affect records
already serving traffic. The sandbox lifecycle is evidence for that production
tool, not a claim that the sandbox itself is a production application.

## Decision

Accept the community provider narrowly, behind an adapter, and make the
acceptance conditional on the exact artifact.

- **Pin the artifact.** Commit the exact provider version and the lockfile's
  checksums. The accepted source, version, and checksum set are explicit.
- **Prove the pin with a complete lifecycle.** Exercise create, import,
  no-change reconciliation, update, and delete against a sandbox zone. Check
  provider-specific behavior before allowing it to manage a live zone.
- **Repeat the proof when the artifact changes.** A different source,
  version, checksum set, or fork reopens acceptance. A check reads the actual
  lockfile and fails on drift from the accepted artifact. Making it pass
  again requires repeating the lifecycle and reviewing the new acceptance.
- **Keep the provider behind an adapter.** Generate zone configuration and
  imports from live inventory. Reject the cases the pinned provider handles
  incorrectly, with those cases enumerated beside the adapter. A record the
  provider cannot represent safely is not silently approximated.
- **Check the adoption result before taking ownership.** Importing existing
  records must produce a no-change reconciliation before ordinary applies.
  This complements [ADR 0014](0014-import-live-dns-over-recreating-it.md):
  accepting the provider does not justify recreating records that already
  carry traffic.

## Consequences

- **A digest is a pin, not provenance.** It establishes that the reviewed
  artifact has not changed. It does not establish who built it or repair the
  missing signature. That supply-chain cost remains part of accepting the
  provider.
- **Acceptance is more work than initialization.** The lifecycle proof must
  be maintained and repeated for an upgrade. A successful download or a
  passing configuration validation is weaker evidence than a provider that
  actually imports, changes, and removes its own records correctly.
- **Provider quirks stay in one place.** The adapter gives callers a checked
  interface rather than requiring every operator to remember the pinned
  version's exceptions. Maintaining those exceptions is an ongoing cost.
- **False refusals are cheaper than silent changes.** A checksum change can
  block work until reviewed. That is recoverable; silently accepting a new
  implementation against traffic-serving DNS is not an equivalent risk.

## Amendment - 2026-10-16

This record previously combined the live DNS provider with an experimental
agent runner. The runner example is withdrawn under the collection's
production-only scope. The decision retained here is exercised by the DNS
operating tool; its acceptance lifecycle and adapter remain the evidence.

## When I'd revisit

If a signed provider becomes available, provenance can improve while the
artifact pin and lifecycle proof remain useful. If exceptions grow beyond
what the adapter can refuse clearly, replace or fork the provider and repeat
the same acceptance before it manages live records.
