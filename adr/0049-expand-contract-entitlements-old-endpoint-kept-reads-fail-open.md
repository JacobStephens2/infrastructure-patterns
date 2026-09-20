# ADR 0049 - A closed, provider-independent entitlement state, migrated expand-then-contract, with the old endpoint kept indefinitely and reads failing open

**Status:** Accepted · in production (a paid, privacy-sensitive charting app with web, App Store, and Play Store clients and live subscription billing)

## Context

A subscription gates one capability of the app: uploading to encrypted sync.
Everything else - charting, local data, downloads - works without it.

The first implementation used one string for everything. The payment
provider's status, the stored entitlement, the access decision, and what the
account holder saw were the same value. Provider values had already escaped
into user-visible behavior through fallthrough branches, and rollout policy
(who gets upload access during a staged launch) was being expressed as if it
were subscription state. A separately writable "sync active" flag sat beside
it, which permitted contradictory combinations of state and access.

Two constraints made the fix harder than a refactor. Founder and
administrative grants must survive provider events that know nothing about
them. And released desktop builds embed old JavaScript while calling the live
API, so an old client can keep calling an old response shape for as long as
someone keeps the app installed.

## Decision

- **Four things are separated**: the provider's status, the stored entitlement,
  effective upload access, and the account-holder view. Provider adapters map
  their statuses into a **closed, provider-independent state**. State plus its
  relevant dates is authoritative for the grant; upload access adds rollout
  policy on top; the view projects only meaningful status, deadlines, offers,
  and permitted actions.
- **Entitlement basis and billing provider are separate fields.** Founder and
  administrative grants are protected from provider events. Region denials and
  revocations stay durable until an explicitly permitted replacement.
- **The raw record is private behind semantic reads and named transitions.**
  Database constraints, runtime parsing, and the type system enforce the same
  model, and the public contracts live in a dependency-free package.
- **Expand, then contract.** The old flag and the overloaded source column stay
  during the expand phase and are removed only once every reader asks the
  entitlement module. Until then they are computed from the new model, so no
  obsolete column becomes a second source of truth.
- **Legacy rows are migrated without changing anyone's access, and without
  guessing.** Ambiguous historical revocations are marked `unclassified`, and
  malformed original tuples are retained for review, because the retained
  audit data cannot reconstruct every legacy row reliably.
- **The new view is a versioned endpoint; the old response stays indefinitely**
  as a compatibility projection.
- **An unexpected entitlement-read failure is operational unavailability, not
  an entitlement state.** Uploads fail open, downloads and local charting stay
  available, shared snapshots stay readable with a warning, status views report
  unavailability, and billing mutations make no provider change.

## Consequences

- Routes, jobs, notices, administration, and clients never interpret raw
  entitlement fields or invent actions.
- Refunds, disputes, incomplete payment, paused billing, region denial, and
  ordinary expiry stay distinguishable wherever the user's next action differs.
- **Failing open gives away uploads during an outage of my own making.** That
  is the right direction for this product: the failure is mine, the data is the
  customer's own record, and a free upload costs far less than a paying
  customer who cannot sync.
- **The old endpoint is a permanent maintenance cost**, accepted because the
  alternative is breaking installed software I cannot update.
- `unclassified` rows are a visible, honest debt rather than an invisible wrong
  guess.

## When I'd revisit

If the old response shape can ever be shown to have no remaining callers, it
can finally go; until that is provable rather than assumed, it stays. If the gated
capability ever becomes expensive per use rather than flat, failing open needs
a ceiling: open, but metered and capped.
