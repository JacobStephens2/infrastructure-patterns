# ADR 0005 - A scoped system user over a shared service account for an autonomous agent

**Status:** Accepted · in production (dedicated agent identity; scope of the claim corrected 2026-10-16)

## Context

An autonomous coding agent runs on a coordination host and acts across several
internal servers - reading databases, running deploys, inspecting services. It
needs credentials, but handing it broad, shared credentials (or letting each
engineer's own credentials flow through it) muddies two things at once:
*authority* (what is the agent allowed to do?) and *attribution* (who did a
given action - the agent, or the human who launched it?).

## Decision

Run the agent as its own dedicated **system user**, distinct from any human:

- Separate database credentials, with grants bound to the source host.
  Review the privileges independently from the identity that holds them.
- Runtime secrets supplied by the launcher from a vault, rather than borrowed
  from whichever human started the session.
- A dedicated launch path, so account selection and secret injection have one
  place to maintain.

## Consequences

- **Clean attribution.** Audit logs read "the agent did X," never "engineer Y
  did X *via* the agent." Any human can trigger it without their own
  credentials becoming the agent's.
- **Identity and authority are separate checks.** A dedicated account makes
  attribution clearer; it does not prove that the grants or host privileges
  are minimal. Those need their own review.
- **Costs:** more up-front host setup (the user, the grants, the launcher, the
  secret-injection path) than reusing an existing account.

## Amendment - 2026-10-16

The original record treated a dedicated identity as proof of least privilege.
That claim was too broad. The decision retained here is separate identity,
host-bound database credentials, and a maintained launch path. Each target's
actual authority must be reviewed separately.

## When I'd revisit

If the agent only ever ran read-only against a single system, a narrowly-scoped
service account would be enough and simpler. The scoped-system-user model earns
its keep precisely because the agent's reach is broad and includes writes.
