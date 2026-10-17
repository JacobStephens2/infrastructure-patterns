# infrastructure-patterns

**Read the collection at [adr.stephens.page](https://adr.stephens.page/).**

The curated home for my best Architecture Decision Records, from every system
I run in production - private and public - written so the *reasoning* is
visible even where the code cannot be.

Only decisions exercised in production applications or their operating tools
belong here. A deployed prototype, an acceptance trial, or a proposed mechanism
does not qualify. Each record states where the decision is used, what I chose,
what I gave up, and when I would choose differently. Measurements keep their
proof boundaries: a dashboard query from 1,441 seconds to 0.196, a six-hour
outage behind a validator that printed green, or a session lock whose fix has
shipped without a production re-measurement.

Records come from two kinds of source, and each says which it is.

- **From a private system:** sanitized and written at the architecture level -
  no hostnames, addresses, credentials, customer data, or colleagues' names.
  The record here is the only public copy.
- **From a public repository:** the record carries a **Source** line. The
  original lives in that repository beside the code it governs and is the
  canonical copy; what is here is the generalized write-up, so the pattern can
  be read without the project's vocabulary.

## Where these come from

| System | Who uses it | Main records |
|---|---|---|
| **A reservations and operations platform** for a group-travel operator: a PHP 8.4 / MySQL 8.4 core modernized in production from PHP 5 / MySQL 5, four portals on one schema. I am its lead engineer. Private. | Office staff daily; tour guides in the field through an offline-capable portal | 0002, 0004, 0006, 0034, 0042-0044, 0058, 0061-0063 |
| **The fleet platform around it**: guarded deploys, an operator console, secrets, observability across the hosts, and Docker-based Manager Sandboxes where non-technical managers work with an AI assistant on a copy of production data. Private. | Me, the engineers I work with, and the managers who own a sandbox | 0001, 0003, 0005, 0007-0009, 0011, 0018-0022, 0027-0029, 0032, 0033, 0040, 0041, 0057-0060 |
| **[thirdshift](https://github.com/JacobStephens2/thirdshift)**, the current open-source issue-to-pull-request factory, with review and repair sessions around deterministic CI and merge decisions. | Me, on my own repositories and the reservations platform's work tracker | 0053-0056 |
| **A project team's planning surfaces**: requirements, review previews, generated status pages, and the CI that checks them. Private. | A five-person project team | 0046, 0047, 0065 |
| **[vaulted-agent](https://github.com/JacobStephens2/vaulted-agent)**: a Rust launcher that resolves per-agent secret manifests into a child process's environment. Public, released. | The fleet above, and anyone who installs it | 0028, 0048 |
| **A paid, privacy-sensitive charting app** on the web, the App Store, and the Play Store, with end-to-end encrypted sync and subscription billing ([architecture slice](https://github.com/JacobStephens2/chart35-showcase)). | Customers on the web, iOS, and Android | 0049, 0050, 0064 |
| **Two copy-deployed sync services**, one for a weightlifting tracker and one for a game. | Users of each app, with separate backends | 0012 |
| **My own fleet**: one VPS serving about 70 hostnames for my products and client sites, with DNS as code across 9 zones ([sanitized mirror](https://github.com/JacobStephens2/terraform-cloudflare-dns)). | Me and my clients | 0014, 0015, 0017, 0030, 0031 |
| **[A small multiplayer word game](https://github.com/JacobStephens2/thereish)** with an LLM grading every attempt live. | A handful of players | 0051 |

## Evidence boundary

Production means a running application or an operating tool used for real
work. Running a trial on a production host or against a real codebase does
not establish that status. Prototypes and unused mechanisms are excluded.

- A **Manager Sandbox** gives a manager and an AI assistant separate application
  files and processes over a shared writable dataset, refreshed nightly.
  Per-manager credentials attribute access; they do not separate the data.
  Code promotion requires engineering review. A separate SELECT-only path reads
  production under server-enforced limits.
- **thirdshift** is used to deliver code. Its records cover the evidence a
  reviewer supplies, the commit whose checks were watched, and a feature's
  review boundary. Deployed behavior and measured outcomes remain separate
  claims; the status line says what the evidence establishes.

## Start here

Eight records that show the range, if you only read a few.

- [0053](adr/0053-a-review-finding-carries-a-failing-test-and-a-decline-cites-the-run.md) -
  **A decline needs evidence.** Correctness findings carry a test the author
  must run, and a declined finding cites the result or a tracked decision.
- [0056](adr/0056-a-features-tickets-merge-into-one-branch-so-review-happens-once.md) -
  **Review the feature once.** Ticket work meets on one branch so the human
  review queue counts features rather than implementation steps.
- [0058](adr/0058-the-hosted-runner-asks-and-the-host-decides.md) - **The hosted
  runner asks; the host decides.** A short-lived OIDC assertion requests a
  deploy while the production host rechecks its authority and eligibility.
- [0061](adr/0061-release-the-session-lock-before-slow-work.md) - **Release the
  session lock before slow work.** Healthy aggregate metrics hid a staff
  member's requests queueing behind each other.
- [0042](adr/0042-read-the-union-view-inline-it-for-aggregates-lint-the-shape.md) -
  **Read the view, inline it for aggregates, lint the shape.** A production
  incident caused by following my own rule, and a lint test as the fix because
  nothing about the results was ever wrong.
- [0028](adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md) -
  **One secret manifest per consumer.** A vault rename took down four units
  for six hours while the validator printed green.
- [0046](adr/0046-preview-containment-in-the-application-proved-by-egress-test.md) -
  **Isolation is proved, not inferred.** A preview override file was present,
  well-formed, and never read; a running egress test became the proof.
- [0064](adr/0064-authority-over-a-shared-record-follows-the-person-it-is-about.md) -
  **Authority follows the person the record is about.** Sharing and billing
  follow that rule through handover, departure, and deletion.

## Decision records

All 52 records, grouped by the problem they belong to. Numbers are
chronological and never reused, so gaps include withdrawn records. Their
history stays in git. The website at
[adr.stephens.page](https://adr.stephens.page/) builds directly from these
records and deploys automatically when changes reach `main`.

### Running AI agents against production systems

Sandbox isolation, identity, and credentials (0001-0010), production workflow
and instruction design (0040-0041), and thirdshift's review and delivery
machinery (0053-0056). The primary-read record (0057) revisits the sandbox's
data boundary.

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0001](adr/0001-docker-over-bare-metal-for-tenant-isolation.md) | Docker over bare-metal for application isolation | Pay container overhead for separate files and processes; shared sandbox data remains a deliberate cost |
| [0003](adr/0003-periodic-snapshot-over-live-replication.md) | Periodic snapshot over live replication for Manager Sandboxes | Accept some staleness to gain isolation, reset-ability, and no prod write-path risk |
| [0005](adr/0005-scoped-system-user-over-service-account.md) | A scoped system user over a shared service account for an autonomous agent | More host setup for per-identity attribution, with database grants and container boundaries reviewed separately |
| [0009](adr/0009-default-deny-host-pinned-db-access.md) | Default-deny, host-pinned DB access over a trusted network | Take on provisioning friction so a leaked credential isn't portable off its host |
| [0010](adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md) | A pixel-equality gate over diff review for changes to generated markup | Pay a render/diff harness to safely change markup you can't audit by eye - it proves visual, not semantic, equality |
| [0040](adr/0040-serial-subagent-rounds-over-detached-parallel-processes.md) | Serial rounds run as harness subagents, over detached parallel CLI processes | Give up throughput and process survival - parallelism saved about ten minutes and cost a merge round, a re-gate, and a second correction - to delete a process-management layer that once resumed the wrong session |
| [0041](adr/0041-one-primary-agent-file-byte-identical-shared-layer-per-host-facts.md) | One primary agent instruction file, a byte-identical shared layer, and per-host environment facts beside it | Add a pointer and a checksum check so every harness, not just one vendor's, is told what a host can touch - after five 'generic' instruction files turned out to have drifted into five versions |
| [0053](adr/0053-a-review-finding-carries-a-failing-test-and-a-decline-cites-the-run.md) | A review finding carries a failing test; a decline cites the run | Spend reviewer effort on runnable evidence and declared coverage so declines can be checked |
| [0054](adr/0054-merge-the-exact-head-whose-ci-was-watched-over-platform-auto-merge.md) | Merge the exact head whose CI was watched | Keep merge authority inside the repair loop, and stop when repository review policy refuses |
| [0055](adr/0055-decide-ci-outcomes-from-structured-state-not-the-agents-account.md) | Decide CI outcomes from structured state | Match failures against the base and grant one unchanged-head re-run, without interpreting agent prose |
| [0056](adr/0056-a-features-tickets-merge-into-one-branch-so-review-happens-once.md) | A feature's tickets merge into one branch so review happens once | Trade ticket-level review for a whole-feature review, accepting early ticket closure and branch CI limits |
| [0057](adr/0057-a-sandbox-reads-the-primary-not-a-replica-that-can-stall-silently.md) | A sandbox reads the primary over a replica that can stall silently | Read canonical state under server-enforced query and account limits, accepting production read load |

### Secrets, access, and perimeter

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0018](adr/0018-runtime-injected-secrets-over-plaintext-config.md) | Runtime-injected secrets over plaintext config, with the store matched to the team | Hold one invariant (encrypted at rest, injected into the environment at runtime) and pay for two backends - a broker where a team needs sharing/revocation/audit, SOPS + age where a solo fleet needs offline zero-vendor recovery - rather than force one tool to fit both |
| [0028](adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md) | One secret manifest per consumer, generated from a tracked declaration; validate every manifest the machine reads | Take on a generator, a startup assertion, and a constants file so a vault rename kills one consumer instead of the box - after a 252-reference shared manifest took down four units for six hours while the validator printed green |
| [0019](adr/0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md) | Reuse an existing passkey session to gate a second app (Caddy forward_auth) over standing up a second auth stack | Gate a second internal app by delegating to one hardened passkey session via Caddy forward_auth - one proxy block and no second credential store, every tool inheriting the gate's future hardening - at the cost of concentrating trust in a single session |
| [0020](adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md) | A private mesh for operator shells, public authenticated endpoints for browser consoles, over one VPN for everything | Put SSH behind a WireGuard mesh and drop public :22 on enrolled hosts, but keep browser admin consoles public behind application authentication - size the boundary to who uses it, rather than hide the consoles non-technical staff reach by URL behind a VPN client they can't maintain |
| [0034](adr/0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md) | A strict root allowlist returning 404 over a growing blocklist returning 403, for a legacy repository-as-webroot | Fail closed against files nobody anticipated and stop confirming their existence to scanners, without the multi-quarter refactor of moving the document root - which the allowlist now guards |
| [0043](adr/0043-audit-history-never-retains-secret-values-retroactively.md) | Audit history never retains secret values, and existing history is migrated to match | Deliberately destroy the recoverability of old credential values, because an audit trail is not a credential store - history keeps who and when, redacts diffs, and omits the field from anything restorable |
| [0044](adr/0044-additive-fail-closed-section-permissions.md) | Section permissions are additive on top of page permissions and fail closed | Make granting more verbose so a hand-built request cannot mutate a section its author cannot view, and a misconfiguration fails as 'cannot see it' rather than 'can' |
| [0027](adr/0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md) | Accept an unsigned DNS provider behind an adapter, with proof keyed to the pin | Pin the artifact and repeat its DNS lifecycle proof when it changes; keep provider quirks inside a checked adapter |
| [0017](adr/0017-self-hosted-signing-instrument-over-saas.md) | Self-host the signing instrument and its audit trail over a SaaS signature service | Take on one container plus its own cert and upkeep so the legally-binding document and its audit trail stay on infra you govern, with a named-human gate on every consequential action - the highest-stakes case of keeping the authoritative copy where you control it |

### Deploy, release, and provisioning

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0004](adr/0004-shell-deploy-over-hosted-ci-runner.md) | A guarded shell deploy over a hosted CI runner | Keep guarded execution on the host; automatic requests now arrive through OIDC from hosted CI |
| [0029](adr/0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md) | Pin the shared serving checkout fast-forward-only, refuse-and-alert on a dirty tree, and guard stale paths | Give up "restart and it's live" on one service to stop the inverted-signal failure where the newest commit carries the oldest content - the pin detects dirt, a stale-path hook guards commits, and interactive sessions now land in the serving checkout |
| [0030](adr/0030-immutable-releases-atomic-promotion-append-only-journal.md) | Immutable per-commit releases, atomic promotion, an append-only journal; re-promotion is a named attended operation; root-pinned authority drift is reported, never a failure | Pay a promoter and a journal so no exit leaves production unnamed, hand-editing the symlink is the thing the design refuses, and a merge can never expand what root pinned - drift is shown, not paged |
| [0031](adr/0031-ci-deploy-key-restricted-to-one-forced-command-over-host-pull.md) | A CI deploy key that reaches a shared host, restricted to one installed forced command, over having the host pull | Let a CI secret reach a host that serves client work because it cannot open a shell - forced command outside the deployed tree, pinned host key - in exchange for sub-minute deploys without a listener or a timer |
| [0046](adr/0046-preview-containment-in-the-application-proved-by-egress-test.md) | Preview containment lives in the application, and isolation is proved by an egress test rather than inferred from a config file | Route outbound effects into inspectable sinks, and refuse to call a slot contained until an egress test passes - after a per-slot override file turned out to be present, well-formed, and never read |
| [0048](adr/0048-static-musl-release-binaries-with-a-ci-guard.md) | Ship static musl release binaries with a CI guard, over glibc builds from whatever the runner has | Give up in-process NSS lookups to remove the glibc floor entirely - after a CI image bump put a non-weak `GLIBC_2.39` reference in a binary that called nothing from 2.39 and broke every stable server distro |
| [0014](adr/0014-import-live-dns-over-recreating-it.md) | Import ~220 live DNS records into Terraform over recreating them from a desired-state list | Accept verbose generated config and provider quirks to adopt traffic-serving records with zero downtime and a no-op baseline plan, instead of risking duplicate-creates and silent deletion of forgotten records |
| [0015](adr/0015-state-off-the-provider-it-provisions.md) | Keep Terraform state on a different provider than the compute it provisions | Take on a second vendor + scoped IAM key so a provider-level outage can't destroy both the infrastructure and the state needed to rebuild it |
| [0058](adr/0058-the-hosted-runner-asks-and-the-host-decides.md) | The hosted runner asks and the host decides | Use short-lived OIDC requests while the host rechecks identity, the commit, CI, and live state |
| [0059](adr/0059-two-processes-one-release-refuse-when-they-disagree.md) | Two processes are one release; refuse when they disagree | Pin the console and worker together and refuse production work when their revisions or liveness disagree |
| [0060](adr/0060-a-failed-deploy-pauses-nothing-and-recovery-reads-production.md) | A failed deploy pauses nothing; recovery reads production | Re-establish eligibility each time and spend one bounded recovery retry against live production evidence |
| [0065](adr/0065-assert-enforcement-at-the-script-the-workflow-and-the-ruleset.md) | Assert enforcement at the script, workflow, and ruleset | Test script/workflow failure propagation and verify active required-check registration before claiming merge is blocked |

### Data, records, and correctness

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0002](adr/0002-external-managed-db-over-containerized.md) | External managed DB over a containerized one | Give up "one compose up" simplicity for durable, backup-friendly state |
| [0006](adr/0006-binlog-daemons-over-database-triggers.md) | Binlog-tailing daemons over database triggers for denormalization | Accept eventual consistency to keep derive-logic in versioned code, off the hot write path |
| [0008](adr/0008-embedded-sqlite-over-networked-db-for-tooling.md) | Embedded SQLite over a networked DB for single-node tooling | Give up cross-host sharing for zero operational surface on state one process owns |
| [0042](adr/0042-read-the-union-view-inline-it-for-aggregates-lint-the-shape.md) | Read the reconciling view by default, inline the union for aggregates, and lint the shape of the restriction | Accept two ways to read one dataset, guarded by a lint test, because MySQL cannot push a non-constant predicate through a UNION - eleven dashboard queries at 493 to 1,441 seconds, the worst to 0.196 once inlined |
| [0047](adr/0047-scripts-hide-rows-and-derive-no-figures.md) | On a generated status site, scripts hide rows and derive no figures | Cost readers a filter-scoped distribution so every number has exactly one definition - enforced as a property of the rendered output, with the check's three blind spots written down beside it |
| [0012](adr/0012-copy-deployed-sync-services-over-shared-multi-tenant-backend.md) | Per-app copy-deployed sync services over a shared multi-tenant backend | Run N near-identical small services to gain physical blast-radius isolation and per-app sync-model freedom, at the cost of hand-applying shared-auth fixes across copies |
| [0049](adr/0049-expand-contract-entitlements-old-endpoint-kept-reads-fail-open.md) | A closed, provider-independent entitlement state, migrated expand-then-contract, with the old endpoint kept indefinitely and reads failing open | Carry a permanent compatibility endpoint because released desktop builds embed old JavaScript, leave ambiguous legacy rows `unclassified` rather than guess, and give away uploads during my own outage rather than lock out a paying customer |
| [0050](adr/0050-one-conformance-corpus-over-three-hand-written-engines.md) | One language-neutral conformance corpus over three hand-written engines | Keep implementing every rule three times for now, but make drift mechanical to detect - amend the corpus first, watch three suites go red - without depending on a shared-engine rewrite that is no longer planned |
| [0051](adr/0051-repeatable-llm-judge-over-accurate-one-when-the-verdict-is-cached.md) | A repeatable LLM judge over a more accurate one when the first verdict is cached as precedent | Pick the model with a constant bias over the one with less bias and more noise, because calibration subtracts an offset once and nothing subtracts variance after the cache has frozen it |
| [0061](adr/0061-release-the-session-lock-before-slow-work.md) | Release the session lock before slow work | Restore concurrent requests for one user, and make accidental mutex behavior explicit |
| [0062](adr/0062-tests-refuse-the-production-schema-and-a-wiring-check-enforces-it.md) | Tests refuse the production schema, with a wiring check | Guard the dangerous database before bootstrap and test that every integration entry point uses the guard |
| [0064](adr/0064-authority-over-a-shared-record-follows-the-person-it-is-about.md) | Authority over a shared record follows the person it is about | Separate billing from authority and make handover, departure, and deletion obey the same rule |

### Observability and capacity

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0007](adr/0007-pull-probes-over-push-agents.md) | Pull-based health probing over push agents for a small fleet | Forgo deep metrics/history to keep the monitored fleet agent-free and the failure domain legible |
| [0011](adr/0011-instrumented-metrics-stack-over-bespoke-prober.md) | A pull-based metrics stack alongside a bespoke prober, data plane kept private | Take on a TSDB to run for real metrics/history/alerting - keep co-located backends on loopback, pin remote exporters to the monitoring host, and publish a static pane while live Grafana stays behind login |
| [0021](adr/0021-shared-collector-seam-over-direct-backend-wiring.md) | A shared OpenTelemetry collector seam over direct backend wiring | Add one collector as the ingestion seam so new telemetry sources and backends are configuration, not new architecture - agent usage metrics only, never prompt content |
| [0022](adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md) | Complete the logs pillar with a co-located local-disk Loki behind the collector seam, over a dedicated or hosted log stack | Add single-binary Loki beside Prometheus/Tempo on the one monitoring node, ingested only through the shared collector seam and bound to localhost - one query surface and native trace-to-logs for near-zero new infrastructure, at the cost of a deeper single-box blast radius and a 31-day local-disk retention ceiling with object storage as the written-down escape hatch |
| [0033](adr/0033-grow-the-disk-and-cap-retention-by-size.md) | Grow the monitoring host's own disk over a block volume, and cap retention by size | Take a one-way, power-off resize because a grandfathered allocation made it free - and accept that the bigger disk is not the guard; the size-based retention cap and log hygiene are |
| [0032](adr/0032-dedicated-host-for-unauthenticated-ingestion-store-private-by-construction.md) | The first unauthenticated-ingestion workload gets its own host; store private by construction; admin gated by a named permission; masking proof per property; abort written before launch | Pay a dedicated small host and a volume so browser-driven POSTs never land beside fleet keys or prod sandboxes, and prove recording first, then inspect stored probes against the policy in force |
| [0063](adr/0063-watch-the-work-not-the-process-with-a-window-longer-than-the-stall.md) | Watch the work, not the process, with a window longer than the stall | Alert on missing work and checkpoints, accepting a detection window long enough to see delayed evidence |

## Companion code

- [`observability/`](observability/) - the sanitized Prometheus and
  Alertmanager configuration and Grafana dashboards behind ADR 0011.
- [thirdshift](https://github.com/JacobStephens2/thirdshift) - the current
  issue-to-pull-request factory behind ADRs 0053-0056.
- [vaulted-agent](https://github.com/JacobStephens2/vaulted-agent) - the
  runtime-secrets launcher behind ADRs 0018, 0028, and 0048.
- [terraform-cloudflare-dns](https://github.com/JacobStephens2/terraform-cloudflare-dns) -
  a sanitized June 2026 snapshot of the Terraform, Cloudflare, and Ansible
  DNS-as-code setup behind ADRs 0014-0015.

## Companion artifacts

The ADRs answer *why*. These answer *how it fits together*.

- **[`case-study/`](case-study/)** - the platform these patterns come from:
  what it looked like when I inherited it, what changed, the measured outcomes,
  and what generalizes.
- **[`threat-model/agent-sandbox.md`](threat-model/agent-sandbox.md)** - the
  threat model I use for running semi-autonomous AI agents against a
  revenue-critical legacy system: scope, assets, actors, threats, controls
  mapped to specific ADRs, and residual risks. Loosely follows
  [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling).
- **[`checklist/operational-review.md`](checklist/operational-review.md)** -
  the operational-review checklist I run before signing off that a system is
  ready to hold real money in production.

## Format

Each ADR uses a short, consistent shape: **Context, Decision, Consequences,
When I'd revisit.** The status line says where the decision is running and who
depends on it, and a Source line follows it when the original is public. They
are deliberately terse.
