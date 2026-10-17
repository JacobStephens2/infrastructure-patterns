# ADR 0001 - Docker over bare-metal for per-tenant isolation

**Status:** Accepted · in production (application isolation; database model amended 2026-06-10)

## Context

I needed to give each of several non-technical business managers a role-specific
instance of the platform: a **Manager Sandbox** able to run an autonomous
coding agent that could read a copy of production data and even edit code,
with separate application files and processes. I originally also gave each
sandbox a separate database; that part changed after adoption. Running all
tenants as processes on one host (bare-metal, shared filesystem, shared DB) would have meant enforcing isolation purely through
application-level conventions, which is exactly the kind of boundary an
autonomous agent erodes.

## Decision

Run each Manager Sandbox as its own container (Docker), behind a single reverse
proxy that routes by hostname. Each container gets its own named volume, its own
resource limits, and a read-only mount of its agent configuration. The
original design also gave each sandbox a database user scoped to its own
database; the amendment below records the move to shared data.

## Consequences

- **Application isolation, cheaply.** Filesystem and process isolation come
  from the container boundary rather than from code discipline, so cross-tenant
  file access becomes a container-escape problem rather than a one-line
  application bug.
- **Uniform provisioning.** Every tenant builds from one image and one compose
  definition, so adding a manager is a config change, not a new server.
- **Costs:** image builds and registry hygiene, per-container resource tuning,
  and the reverse-proxy/TLS layer become part of the system you own. Memory
  footprint is higher than co-located processes.

## Amendment - 2026-06-10

The separate databases became one shared writable sandbox database, with
per-manager credentials. The current design refreshes it daily from production. Containers still separate
application files and processes. The database users provide credentials and
attribution, not data separation: one manager's database experiments can affect
the others. Cheaper refreshes bought that coupling. This is a change to the
original design, not a property Docker supplies.

The [published case study](https://stephens.page/blog/one-engineer-platform-production-systems/)
describes this boundary. [ADR 0003](0003-periodic-snapshot-over-live-replication.md)
records the refresh cadence.

## When I'd revisit

If tenants needed *stronger* isolation than namespaces give (hostile
multi-tenant, untrusted code from outside the org), I'd move to per-tenant VMs
or microVMs. If they needed *less* (fully trusted, no agent), bare-metal with
per-user accounts would be simpler.
