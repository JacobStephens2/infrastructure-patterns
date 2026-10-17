# ADR 0032 - The first workload with unauthenticated browser ingestion gets its own host; the store is private by construction; admin is gated by a named permission; proof is per property, and the abort is written before launch

**Status:** Accepted · host, store, and retention machinery in production (four properties live; recording first verified on 2026-09-24; post-launch clocks wait for the designated customer-facing launch)

## Context

Self-hosting web analytics with session replay meant, for the first time, a
fleet workload whose front door accepts **unauthenticated POSTs from
arbitrary browsers**. Five hosts already ran Docker and could have taken it
cheaply. Each was disqualified by what else it held: fleet SSH keys and the
vault service token; prod-data sandboxes; a deliberately lower-trust preview
box; single-purpose builds whose disk would now grow with replay payloads. The
monitoring host stayed rejected for a second reason: the application would
eventually *read* analytics, and that would make monitoring a thing the
application depends on.

Replay also raises the stakes of ordinary hosting choices: recordings are
PII by construction, the upstream product has no read permission of its own
(any account on a site can pull its replays from the API), and the masking
configuration is a database blob with no file, no env var, and no export.

## Decision

- **One dedicated small host, with the database co-located.** A separate
  database host buys fate-isolation with no value (a store whose only client
  is down is useless) and costs a second box, a network hop per event, and a
  password someone must deliver. Disk growth is answered by a resizable block
  volume that outlives the host; the pruner reaches the database over a local
  socket and holds no network credential.
- **The store is unreachable from the internet by construction.** Same region
  and VPC as the only cross-host reader, so that reader uses a private address
  under a read-only role: no public listener and no firewall rule that could be
  deleted out of.
- **One hostname; collector paths public; everything else behind
  `forward_auth`** to the existing console session
  ([ADR 0019](0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md)),
  requiring a **named permission** in the console's permission model rather
  than "has a session" (which admits contractor and docs-only accounts) or an
  email list in a Caddyfile on another host (which drifts the moment someone
  leaves). Because the product has no read permission, this gate *is* the
  access control, not the first layer of one. The permission is named for what
  it gates: the whole analytics store, since record ids travel in page paths,
  so nobody reasons "it's only analytics, give them a login."
- **Cookie scope follows host trust.** Here the console cookie is
  domain-scoped so the gate works across hosts, because every hostname under
  that domain is the same operator's. On a box serving dozens of hostnames
  including client work, the opposite call held ([ADR 0031](0031-ci-deploy-key-restricted-to-one-forced-command-over-host-pull.md)).
- **Image pinned to a digest**, not a tag: every load-bearing fact about
  masking and payload size was measured against one exact version, and an
  unattended minor bump could invalidate any of them silently.
- **Dump the durable table, let the disposable one go.** Provider host
  backups do not cover attached volumes and would protect nothing that
  matters. Nightly `pg_dump` excluding the replay table (the bulk of the bytes,
  worthless a day later), pulled to another host, fourteen days deep. The
  host is Compose plus a volume, so a rebuild is a re-provision, not a
  restore; created by the IaC stack rather than adopted.
- **Masking proof is per property, and it is ordered.** First prove that a
  recording exists for the expected property and identity. Then inspect the
  store with known probes: an empty result before recording is established
  proves nothing. The passing result follows the policy in force, so a
  policy change voids proof taken under the previous one. The proof must
  distinguish excluded regions from content the policy permits retaining.
  Player screenshots support the store query; they never replace it. The
  verification flag is per host, default off, and prohibited on any non-prod
  host that reads live production data.
- **The masking policy has a source of truth in the repo**, and the database
  blob is deployed state. A restore that cannot verify the blob's exact values
  leaves collection disabled until the post-restore gate confirms masking is
  active.
- **The abort procedure is written before the first session is recorded**,
  and its order is counterintuitive: replay off at the toggle immediately,
  delete the affected rows by site and time window, *then* diagnose. The
  delete-by-window capability was added to the pruning script while it was
  still being written, not improvised during an incident.

## Consequences

- **A gate whose failure has no consequence is a wish.** Two post-launch
  gates carry teeth: on day 31 the retention job must have deleted something
  (on day 1 a correct run deletes zero and proves nothing); at day 90, five
  named support tickets a replay changed the outcome of - or replay is turned
  off and analytics kept.
- **The console's auth endpoint became a hard dependency of the admin UI.** If
  the console host is down nobody reads analytics, while the collector keeps
  ingesting - the half that matters.
- **Viewing is logged** (the reverse proxy's request log on the replay host,
  retained deliberately) because the product cannot do it, and the staff
  notice says so. Attribute values and media URLs are *knowingly retained*
  under a stated three-person access policy, not blocked by default, with the
  conditions written down.
- **Deletion-on-request removes replays, not the person.** Page paths carrying
  record ids stay identifying after the replays are gone, so the claim is
  stated as *replays are deleted; the visit record is not*.

## Amendment - 2026-10-16

Four properties are live, and the first recording was verified on
2026-09-24. This is not the launch date for the two post-launch gates. The
source chose the designated customer-facing property's first production
session as that date, so staff sessions do not start the day-31 retention
or day-90 usefulness clock. The launch date is not yet set.

The proof standard also changed: recording must be demonstrated before a
cleanliness query can mean anything, and the passing result must match the
configuration in force. Reusing an older proof after a policy change would
certify a recorder that no longer exists.

## When I'd revisit

If a second unauthenticated-ingestion workload arrives, it does not join this
host; the reasoning that kept this one off the others keeps the next one off
this. If the product grows a real read permission, the `forward_auth` gate
becomes the first layer again and the permission model inside the product
takes the named list. If the day-31 volume check says the model was wrong by
3x, the knob is duration or sampling, not the host.
