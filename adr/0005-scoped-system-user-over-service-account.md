# ADR 0005 - A scoped system user over a shared service account for an autonomous agent

**Status:** Accepted · in production

## Context

An autonomous coding agent runs on a coordination host and acts across several
internal servers - reading databases, running deploys, inspecting services. It
needs credentials, but handing it broad, shared credentials (or letting each
engineer's own credentials flow through it) muddies two things at once:
*authority* (what is the agent allowed to do?) and *attribution* (who did a
given action - the agent, or the human who launched it?).

## Decision

Run the agent as its own dedicated, least-privilege **system user**, distinct
from any human:

- Database grants scoped to exactly what the agent needs, and bound so they
  only work from the agent's host.
- Secrets injected into the agent's environment at launch from a vault - the
  agent uses them but never has them sitting on disk in its workspace.
- A single, narrowly-scoped privilege-escalation path (one launcher), rather
  than broad sudo.

## Consequences

- **Clean attribution.** Audit logs read "the agent did X," never "engineer Y
  did X *via* the agent." Any human can trigger it without their own
  credentials becoming the agent's.
- **Least privilege by construction.** The blast radius is whatever the scoped
  user can reach - known and small - not whatever the launching human happens
  to have.
- **Costs:** more up-front host setup (the user, the grants, the launcher, the
  secret-injection path) than reusing an existing account.

## When I'd revisit

If the agent only ever ran read-only against a single system, a narrowly-scoped
service account would be enough and simpler. The scoped-system-user model earns
its keep precisely because the agent's reach is broad and includes writes.
