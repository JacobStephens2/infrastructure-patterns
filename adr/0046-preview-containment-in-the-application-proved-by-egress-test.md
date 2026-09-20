# ADR 0046 - Preview containment lives in the application, and isolation is proved by an egress test rather than inferred from a config file

**Status:** Accepted · in production (a long-lived review slot on the preview host, used by a five-person project team to review unreleased work)

## Context

A new product area needed a long-lived preview environment: reviewers work in
it for weeks, create test records, and come back to them. The plan on paper
assumed the preview tier already contained outbound effects, with a shared
frozen database mirror and an email-rerouting setting.

Checking the plan against the machine found something else. The preview tier
was running a live transactional-email key, with two gaps in the rerouting that
was supposed to make that safe, and **production SMS credentials**. The slot the
plan named did not exist. And the per-slot environment override mechanism that
was meant to fix all of this per slot **silently did nothing**: the file was
present, well-formed, and never read.

That last finding is the one that shaped the decision. Every slot with an
override file looked contained to anyone who checked for the file.

## Decision

- **A dedicated writable schema, cloned once.** No shared frozen mirror and no
  continuous refresh, because review work has to survive between sessions and a
  refresh erases it. No production writes.
- **Containment is application-level, not a network block.** Email goes to a
  local mail catcher. SMS goes to an authenticated in-product sink. The
  video-meeting provider is replaced by a credential-free simulator that honors
  the same domain contract, so the code path under review is the real one up to
  the edge.
- **Isolation is verified, never inferred.** It is established by an egress
  test and by reading the *resolved* container configuration. The presence of
  an override file is not evidence of anything.
- **Do not claim containment until it is verified.** Until the egress test
  passes on a slot, that slot is described as uncontained.
- **Copied production personal data is allowed only inside a preview whose
  isolation has been verified**, for authorized reviewers. Anything that
  becomes permanent evidence - a screenshot in a ticket, a fixture, a recorded
  walkthrough - is synthetic or redacted. If the isolation evidence ever fails,
  the allowance reverts.

## Consequences

- **A network-level guarantee is deliberately declined.** A default-deny egress
  rule on the slot would be stronger and would catch a sink I forgot. It was
  weighed and not built, and that choice is recorded rather than left to look
  like an oversight. The egress test is the compensating control: it is what
  notices a new outbound integration nobody rerouted.
- **Sinks make the preview more useful, not only safer.** Reviewers can read the
  email and the SMS the system would have sent, which a network block would
  have turned into a silent failure.
- **Each new outbound integration needs its own sink**, and nothing forces that
  except the egress test going red.
- **The one-time clone drifts from production's schema.** Migrations have to be
  applied to the slot by hand as they land, because the normal migration flow
  does not reach it.

## When I'd revisit

If a second team starts using preview slots, or a slot ever holds data more
sensitive than this one's, the network block gets built underneath the
application sinks - both, not either. If review work no longer needs to survive
between sessions, the one-clone rule gives way to the periodic snapshot of
[ADR 0003](0003-periodic-snapshot-over-live-replication.md).
