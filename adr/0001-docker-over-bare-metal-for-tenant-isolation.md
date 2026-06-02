# ADR 0001 — Docker over bare-metal for per-tenant isolation

**Status:** Accepted · in production

## Context

I needed to give each of several non-technical business managers their own
AI-assisted instance of an internal app — each able to run an autonomous
coding agent that could read a copy of production data and even edit code,
without any tenant being able to see or damage another's data, the host, or
production. Running all tenants as processes on one host (bare-metal, shared
filesystem, shared DB) would have meant enforcing isolation purely through
application-level conventions, which is exactly the kind of boundary an
autonomous agent erodes.

## Decision

Run each tenant as its own container (Docker), behind a single reverse proxy
that routes by hostname. Each container gets its own named volume, its own
database user scoped to its own database, its own resource limits, and a
read-only mount of its agent configuration.

## Consequences

- **Hard isolation, cheaply.** Filesystem and process isolation come from the
  container boundary rather than from code discipline. A tenant's agent simply
  cannot reach another tenant's files.
- **Uniform provisioning.** Every tenant builds from one image and one compose
  definition, so adding a manager is a config change, not a new server.
- **Costs:** image builds and registry hygiene, per-container resource tuning,
  and the reverse-proxy/TLS layer become part of the system you own. Memory
  footprint is higher than co-located processes.

## When I'd revisit

If tenants needed *stronger* isolation than namespaces give (hostile
multi-tenant, untrusted code from outside the org), I'd move to per-tenant VMs
or microVMs. If they needed *less* (fully trusted, no agent), bare-metal with
per-user accounts would be simpler.
