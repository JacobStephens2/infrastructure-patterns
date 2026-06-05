# ADR 0009 — Default-deny, host-pinned database access over a trusted network

**Status:** Accepted · in production

## Context

The managed database ([ADR 0002](0002-external-managed-db-over-containerized.md))
is reached by several clients — app containers, the coordination host, batch
jobs. The convenient model is a *trusted internal network*: anything inside the
perimeter may connect, and a username/password is the only gate. That makes the
network boundary the entire security story, and it means a single leaked
credential is usable from anywhere inside that boundary.

## Decision

Default-deny at two layers. The database's port is firewalled to an explicit
allowlist of client IPs, and each database user's grants are *pinned to the host*
it connects from — so a credential is inert anywhere but its intended client.
Adding a client is a deliberate two-step: open the firewall for that IP and
create a host-scoped grant. This composes with the per-agent identity work in
[ADR 0005](0005-scoped-system-user-over-service-account.md).

## Consequences

- **A leaked credential isn't portable.** It only works from an
  already-allowlisted host, so theft of the secret alone doesn't buy access.
- **Access is auditable by construction.** The allowlist *is* the list of who
  can connect; there's no ambient "anything on the network can reach the data."
- **Costs:** provisioning friction — every new client is an explicit change in
  two places — and the standing discipline to keep the allowlist current as
  hosts come and go.

## When I'd revisit

At a scale where clients are dynamic or ephemeral — autoscaling, short-lived
workers — per-IP pinning becomes a bottleneck, and the right move is a private
network with short-lived issued credentials, or a connection proxy. The pinning
model earns its keep precisely when clients are few, long-lived, and known.
