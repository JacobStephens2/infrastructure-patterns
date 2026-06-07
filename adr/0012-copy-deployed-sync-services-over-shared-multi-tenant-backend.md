# ADR 0012 - Per-app copy-deployed sync services over a shared multi-tenant backend

**Status:** Accepted · in production

## Context

A proven account+sync backend already existed for one app: email+password auth,
opaque server-side sessions (httpOnly cookie for web, bearer token for the
native WebView), email verification, password reset, rate limiting, and a
per-user cloud-save store. A second app now needed the same accounts-and-sync
capability.

The instinct is to *promote* the existing service into a shared multi-tenant
backend: one process, one database, an `app_id` column, both apps' users behind
one auth system. That looks like the more "platform" choice and it reuses the
most code.

But the two apps disagree on the part that matters. The first stores
**row-structured records** and syncs with row-level last-write-wins plus
tombstones. The second stores a **single opaque save blob** and needs
whole-object conflict detection - a row merge of an opaque blob is meaningless
and would manufacture corrupt hybrids. So "share the backend" doesn't actually
share the sync engine; it shares only the auth/session tables (a few hundred
lines of idempotent DDL that copy verbatim) while forcing the one process to
carry two incompatible sync models behind an `app_id` discriminator. And it
couples the blast radius: a bad migration or a runaway `DELETE` driven by the
second app's release cadence now reaches the first app's production data.

## Decision

Copy-deploy the skeleton as a **separate service per app** instead of sharing
one backend:

- **Each app gets its own service, database, role, port, and systemd unit.**
  The auth/session/token layer is copied near-verbatim; only branding, the
  cookie name, the origin allowlist, and the email templates change.
- **The sync layer is rewritten per app to fit that app's data model** -
  row-level merge for one, whole-blob hash-based optimistic concurrency for the
  other - rather than generalized behind a tenant flag.
- **Isolation is physical, not logical.** No shared tables, no shared process,
  no shared database. A fault in one app's service or schema cannot touch the
  other's data. Each binds to loopback behind its own reverse-proxy path.
- **The "platform" claim is earned by the skeleton copy-deploying cleanly**, not
  by collapsing two apps into one tenant table. The reusable asset is the
  *pattern* (this ADR plus the auth skeleton), proven by a clean second
  deployment.

## Consequences

- **Blast radius is contained by construction.** One app's bug, migration, or
  account-deletion path is incapable of reaching the other's users or saves -
  the strongest version of the isolation [0001](0001-docker-over-bare-metal-for-tenant-isolation.md)
  and [0009](0009-default-deny-host-pinned-db-access.md) argue for, applied at
  the service boundary.
- **Each app keeps the sync semantics it actually needs.** No lowest-common-
  denominator merge engine, no `if app_id == ...` branches in the hot path.
- **N near-identical services to run, not one.** More systemd units, more
  databases, more `.env` files - real operational multiplicity. It is bearable
  because each unit is tiny, loopback-bound, and identical in shape, and because
  the duplicated surface (auth) is the stable, rarely-changing part.
- **Shared auth code drifts unless tended.** Copies diverge; a security fix to
  the auth skeleton must be applied to each copy. That cost is accepted as the
  price of isolation, and it is the trigger in "When I'd revisit."
- **The reuse is legible.** A new app stands up accounts+sync by copying the
  skeleton and writing only its sync module - the decision record, not a shared
  runtime, is what's reused.

## When I'd revisit

If the fleet grows to enough apps that hand-applying auth-skeleton fixes across
copies becomes the dominant maintenance cost, extract the auth/session layer
into a shared, versioned library (still copy-*run*, shared *code*) before
considering a shared *runtime*. A genuine need for cross-app identity - one
account spanning several apps, single sign-on - is the case that actually
justifies a multi-tenant backend, and is the point at which the coupling buys
something the per-app copies can't. Short of those, the per-service isolation
wins.
