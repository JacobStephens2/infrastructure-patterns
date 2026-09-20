# infrastructure-patterns

The curated home for my best Architecture Decision Records, from every system
I run in production - private and public - written so the *reasoning* is
visible even where the code cannot be.

Every record here comes from something that is live and that someone uses. Each
one states what I chose, what I gave up, and when I would choose differently.
Where a decision came out of an incident or a measurement, the number is in
the record: a dashboard query that went from 1,441 seconds to 0.196, a
six-hour outage behind a validator that printed green, a ticket whose count of
276 had become 303 by the time an agent picked it up.

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
| **A reservations and operations platform** for a group-travel operator: a PHP 8 / MySQL 8 core modernized in production from PHP 5 / MySQL 5, four portals on one schema. I am its lead engineer. Private. | Office staff daily; tour guides in the field through an offline-capable portal | 0002, 0004, 0006, 0034, 0042-0044 |
| **The fleet platform around it**: guarded deploys, an operator console, secrets, observability across the hosts, and Docker-based Manager Sandboxes where non-technical managers work with an AI assistant on a copy of production data. Private. | Me, the engineers I work with, and the managers who own a sandbox | 0001, 0003, 0005, 0007-0009, 0011, 0018-0022, 0028-0030, 0032, 0033, 0040, 0041, 0045-0047 |
| **[Tracewake](https://github.com/JacobStephens2/tracewake)**, an unattended coding loop: picks up a ticket, runs each agent iteration in a fresh microVM, opens a draft pull request with nobody watching. Public. | Me, dispatching against the platform's real work tracker | 0023-0027, 0036-0039 |
| **[vaulted-agent](https://github.com/JacobStephens2/vaulted-agent)**: a Rust launcher that resolves per-agent secret manifests into a child process's environment. Public, released. | The fleet above, and anyone who installs it | 0028, 0048 |
| **A paid, privacy-sensitive charting app** on the web, the App Store, and the Play Store, with end-to-end encrypted sync and subscription billing ([architecture slice](https://github.com/JacobStephens2/chart35-showcase)). | Customers on the web, iOS, and Android | 0012, 0049, 0050 |
| **My own fleet**: one VPS serving about 70 hostnames for my products and client sites, with DNS as code across 9 zones ([sanitized mirror](https://github.com/JacobStephens2/terraform-cloudflare-dns)). | Me and my clients | 0014, 0015, 0017, 0031 |
| **A small multiplayer word game** with an LLM grading every attempt live. | A handful of players | 0051 |

## Evidence boundary

Two environments do two different jobs, and I keep them apart on purpose.

- A **Manager Sandbox** is a role-specific instance of the platform running in
  a Docker container. It gives a manager and an AI assistant an isolated place
  to explore data and prototype changes before human-reviewed promotion.
- **Tracewake** is a single-operator unattended coding loop. Each agent
  iteration runs in a fresh microVM under a short, asserted credential
  inventory. It is not a Manager Sandbox. ADR
  [0023](adr/0023-attendedness-is-a-fourth-trust-axis.md) is about why that
  one boundary is worth its cost at single-operator scale and a heavier
  multi-tenant design is not.

## Start here

Eight records that show the range, if you only read a few.

- [0023](adr/0023-attendedness-is-a-fourth-trust-axis.md) - **Attendedness is a
  fourth trust axis.** Why an unattended agent re-earns a microVM boundary even
  at single-operator scale, and why nothing else from the heavy design comes
  back with it.
- [0036](adr/0036-review-capacity-over-a-daily-spend-cap-for-unattended-dispatch.md) -
  **Bound unattended dispatch by review capacity.** The scarce resource in an
  agent pipeline is human review, so that is what the limiter should count.
- [0037](adr/0037-completeness-check-derives-its-own-denominator.md) - **A
  completeness check derives its own denominator.** Backpressure for an agent
  task that has no test suite, and why the number in the ticket is never the
  number to check against.
- [0042](adr/0042-read-the-union-view-inline-it-for-aggregates-lint-the-shape.md) -
  **Read the view, inline it for aggregates, lint the shape.** A production
  incident caused by following my own rule, and a lint test as the fix because
  nothing about the results was ever wrong.
- [0028](adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md) -
  **One secret manifest per consumer.** A vault rename took down four units for
  six hours while the validator printed green. What changed so the next one
  kills one consumer instead of the box.
- [0045](adr/0045-append-only-jsonl-in-git-as-the-only-record.md) - **JSONL in
  git as the only record.** Reversing my own decision fifteen days later, after
  finding that the backup it depended on was never built.
- [0046](adr/0046-preview-containment-in-the-application-proved-by-egress-test.md) -
  **Isolation is proved, not inferred.** A preview tier holding production SMS
  credentials behind an override file that was present, well-formed, and never
  read.
- [0048](adr/0048-static-musl-release-binaries-with-a-ci-guard.md) - **Static
  musl releases with a CI guard.** A binary that called nothing from glibc 2.39
  and still refused to load without it.

## Decision records

All 50 records, grouped by the problem they belong to. Numbers are
chronological and never reused, so a gap is a record that was withdrawn. These also read on the web, rendered from this
repo, at [stephens.page/decisions](https://stephens.page/decisions/).

### Running AI agents against production systems

Isolation, identity, and credentials first (0001-0010), then the unattended case where nobody is watching (0023-0026, 0035), then what it takes to operate that loop day to day (0036-0041).

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0001](adr/0001-docker-over-bare-metal-for-tenant-isolation.md) | Docker over bare-metal for per-tenant isolation | Pay image/ops overhead to get strong filesystem + DB-user isolation cheaply |
| [0003](adr/0003-periodic-snapshot-over-live-replication.md) | Periodic snapshot over live replication for Manager Sandboxes | Accept some staleness to gain isolation, reset-ability, and no prod write-path risk |
| [0005](adr/0005-scoped-system-user-over-service-account.md) | A scoped system user over a shared service account for an autonomous agent | More host setup in exchange for clean per-action auditing and least privilege |
| [0009](adr/0009-default-deny-host-pinned-db-access.md) | Default-deny, host-pinned DB access over a trusted network | Take on provisioning friction so a leaked credential isn't portable off its host |
| [0010](adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md) | A pixel-equality gate over diff review for changes to generated markup | Pay a render/diff harness to safely change markup you can't audit by eye - it proves visual, not semantic, equality |
| [0023](adr/0023-attendedness-is-a-fourth-trust-axis.md) | Attendedness is a fourth trust axis: a per-iteration microVM boundary for unattended agents, even at single-operator scale | Re-earn exactly one subsystem - the execution boundary - because "I notice and fix" is the premise that lets solo-scale isolation collapse, and an unattended run is defined by nobody noticing; everything else in the heavy factory stays deleted |
| [0024](adr/0024-asserted-credential-inventory-is-the-isolation-seam.md) | A short, script-asserted credential inventory on the agent box; the inventory, not the network hop, is the isolation seam | Three base credentials plus one repo token per target, asserted in both directions before every dispatch - so the box's reach is enumerable, single-host mode is gated on passing the same check, and every "just add a mail credential" reopens the two lists whose value is being short |
| [0025](adr/0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md) | The model credential inside the boundary: a long-lived subscription token by environment, over per-iteration renewal or a metered key | Keep the flat-rate cost control and give up proxy-injected isolation - bounded instead by deny-all egress, a sandbox that dies per iteration, a token that revokes alone, and a diff scan that refuses to push the token pattern |
| [0026](adr/0026-one-boundary-harness-vendor-facts-in-the-leaf.md) | The agent is a substitutable command: one boundary harness, vendor facts in a leaf | Pay a harness/leaf split and double-asserted structural tests so the loop is a claim about a technique rather than a vendor, and a third agent is a leaf, not a second copy of the lifecycle |
| [0035](adr/0035-sandbox-namespaces-under-systemd-hardening-prove-from-the-live-unit.md) | Let the hardened service create namespaces so the sandbox can confine the model; hold the boundary in AppArmor; prove from the live unit | Loosen one systemd restriction that no narrower setting can express, keep the kernel and profile layers that make it safe, and never again certify a sandbox from an attended shell that the service could not start |
| [0036](adr/0036-review-capacity-over-a-daily-spend-cap-for-unattended-dispatch.md) | Bound unattended dispatch by human review capacity, over a daily spend cap | Give up a hard spend ceiling (the subscription already is one) so throughput tracks the scarce thing - review - and headroom returns the moment a proposal is merged instead of when a 24-hour window rolls |
| [0037](adr/0037-completeness-check-derives-its-own-denominator.md) | An agent's completeness check derives its own denominator and declares what it left out | Pay for a generic checker so a task with no test suite still has backpressure - after the ticket's own count (276) had drifted to 303 by the time the agent picked it up, which a check against the ticket would have passed |
| [0038](adr/0038-guardrail-reads-every-unattended-tree-unknown-is-never-green.md) | The guardrail reads every tree that runs unattended, and unknown is never green | Take on a declared list of trees so an unreviewed commit in the instance's config repo cannot hide behind a green chip for the product repo - and journal a reading on idle cycles so silence only ever means the loop stopped |
| [0039](adr/0039-containment-below-configuration-for-previewing-unreviewed-code.md) | Preview unreviewed code on the credentialed host, with containment below configuration | Allow a branch to render where production credentials live because someone is watching it - and make the database grant, not the connection string, the control, since the previewed code is exactly the code that might ignore its config |
| [0040](adr/0040-serial-subagent-rounds-over-detached-parallel-processes.md) | Serial rounds run as harness subagents, over detached parallel CLI processes | Give up throughput and process survival - parallelism saved about ten minutes and cost a merge round, a re-gate, and a second correction - to delete a process-management layer that once resumed the wrong session |
| [0041](adr/0041-one-primary-agent-file-byte-identical-shared-layer-per-host-facts.md) | One primary agent instruction file, a byte-identical shared layer, and per-host environment facts beside it | Add a pointer and a checksum check so every harness, not just one vendor's, is told what a host can touch - after five 'generic' instruction files turned out to have drifted into five versions |

### Secrets, access, and perimeter

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0018](adr/0018-runtime-injected-secrets-over-plaintext-config.md) | Runtime-injected secrets over plaintext config, with the store matched to the team | Hold one invariant (encrypted at rest, injected into the environment at runtime) and pay for two backends - a broker where a team needs sharing/revocation/audit, SOPS + age where a solo fleet needs offline zero-vendor recovery - rather than force one tool to fit both |
| [0028](adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md) | One secret manifest per consumer, generated from a tracked declaration; validate every manifest the machine reads | Take on a generator, a startup assertion, and a constants file so a vault rename kills one consumer instead of the box - after a 252-reference shared manifest took down four units for six hours while the validator printed green |
| [0019](adr/0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md) | Reuse an existing passkey session to gate a second app (Caddy forward_auth) over standing up a second auth stack | Gate a second internal app by delegating to one hardened passkey session via Caddy forward_auth - ~40 lines of Caddyfile, zero new auth code, every tool inheriting the gate's future hardening - at the cost of concentrating trust in a single session |
| [0020](adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md) | A private mesh for operator shells, public MFA-gated endpoints for browser consoles, over one VPN for everything | Put SSH behind a WireGuard mesh and drop public :22, but keep browser admin consoles public behind per-audience MFA - size the boundary to who uses it, rather than hide the consoles non-technical staff reach by URL behind a VPN client they can't maintain |
| [0034](adr/0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md) | A strict root allowlist returning 404 over a growing blocklist returning 403, for a legacy repository-as-webroot | Fail closed against files nobody anticipated and stop confirming their existence to scanners, without the multi-quarter refactor of moving the document root - which the allowlist now guards |
| [0043](adr/0043-audit-history-never-retains-secret-values-retroactively.md) | Audit history never retains secret values, and existing history is migrated to match | Deliberately destroy the recoverability of old credential values, because an audit trail is not a credential store - history keeps who and when, redacts diffs, and omits the field from anything restorable |
| [0044](adr/0044-additive-fail-closed-section-permissions.md) | Section permissions are additive on top of page permissions and fail closed | Make granting more verbose so a hand-built request cannot mutate a section its author cannot view, and a misconfiguration fails as 'cannot see it' rather than 'can' |
| [0027](adr/0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md) | Enroll an unsigned third-party executable by pinning the exact artifact and keying its acceptance proof to the pin | Accept an unsignable IaC provider and a self-updating agent runner by pinning bytes, proving the pin with a real lifecycle, refusing work until the proof matches the installed pin, and never letting the dependency be the interface - a false pause is recoverable, a silently dropped boundary is not |
| [0017](adr/0017-self-hosted-signing-instrument-over-saas.md) | Self-host the signing instrument and its audit trail over a SaaS signature service | Take on one container plus its own cert and upkeep so the legally-binding document and its audit trail stay on infra you govern, with a named-human gate on every consequential action - the highest-stakes case of keeping the authoritative copy where you control it |

### Deploy, release, and provisioning

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0004](adr/0004-shell-deploy-over-hosted-ci-runner.md) | A guarded shell deploy over a hosted CI runner | Forgo ecosystem features for a dependency-free, auditable single-server deploy |
| [0029](adr/0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md) | Pin the shared serving checkout fast-forward-only, refuse-and-alert on a dirty tree, edit only in worktrees | Give up "restart and it's live" on one service to stop the inverted-signal failure where the newest commit carries the oldest content - the pin is a detector, the default worktree and a stale-path pre-commit hook are the barrier |
| [0030](adr/0030-immutable-releases-atomic-promotion-append-only-journal.md) | Immutable per-commit releases, atomic promotion, an append-only journal; re-promotion is a named attended operation; root-pinned authority drift is reported, never a failure | Pay a promoter and a journal so no exit leaves production unnamed, hand-editing the symlink is the thing the design refuses, and a merge can never expand what root pinned - drift is shown, not paged |
| [0031](adr/0031-ci-deploy-key-restricted-to-one-forced-command-over-host-pull.md) | A CI deploy key that reaches a shared host, restricted to one installed forced command, over having the host pull | Let a CI secret reach a host that serves client work because it cannot open a shell - forced command outside the deployed tree, pinned host key - in exchange for sub-minute deploys without a listener or a timer |
| [0046](adr/0046-preview-containment-in-the-application-proved-by-egress-test.md) | Preview containment lives in the application, and isolation is proved by an egress test rather than inferred from a config file | Decline a network block in favor of inspectable sinks, and refuse to call a slot contained until an egress test passes - after a per-slot override file turned out to be present, well-formed, and never read |
| [0048](adr/0048-static-musl-release-binaries-with-a-ci-guard.md) | Ship static musl release binaries with a CI guard, over glibc builds from whatever the runner has | Give up in-process NSS lookups to remove the glibc floor entirely - after a CI image bump put a non-weak `GLIBC_2.39` reference in a binary that called nothing from 2.39 and broke every stable server distro |
| [0013](adr/0013-staged-declarative-provisioning-over-imperative-bootstrap.md) | Staged declarative provisioning (Terraform + cloud-init + separate deploy) over one imperative bootstrap script | Take on Terraform state and a deliberately create-only provisioning token for a single box to get a reproducible, reviewable host and a clean provision/configure/deploy seam |
| [0014](adr/0014-import-live-dns-over-recreating-it.md) | Import ~220 live DNS records into Terraform over recreating them from a desired-state list | Accept verbose generated config and provider quirks to adopt traffic-serving records with zero downtime and a no-op baseline plan, instead of risking duplicate-creates and silent deletion of forgotten records |
| [0015](adr/0015-state-off-the-provider-it-provisions.md) | Keep Terraform state on a different provider than the compute it provisions | Take on a second vendor + scoped IAM key so a provider-level outage can't destroy both the infrastructure and the state needed to rebuild it |

### Data, records, and correctness

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0002](adr/0002-external-managed-db-over-containerized.md) | External managed DB over a containerized one | Give up "one compose up" simplicity for durable, backup-friendly state |
| [0006](adr/0006-binlog-daemons-over-database-triggers.md) | Binlog-tailing daemons over database triggers for denormalization | Accept eventual consistency to keep derive-logic in versioned code, off the hot write path |
| [0008](adr/0008-embedded-sqlite-over-networked-db-for-tooling.md) | Embedded SQLite over a networked DB for single-node tooling | Give up cross-host sharing for zero operational surface on state one process owns |
| [0042](adr/0042-read-the-union-view-inline-it-for-aggregates-lint-the-shape.md) | Read the reconciling view by default, inline the union for aggregates, and lint the shape of the restriction | Accept two ways to read one dataset, guarded by a lint test, because MySQL cannot push a non-constant predicate through a UNION - eleven dashboard queries at 493 to 1,441 seconds, the worst to 0.196 once inlined |
| [0045](adr/0045-append-only-jsonl-in-git-as-the-only-record.md) | An append-only JSONL file in git as the only record, over a database with a promised backup | Reverse a fifteen-day-old decision after finding its promised backup was never built - trade a seconds-long single-machine window for tamper-evidence that comes from the shape of the file, with a generator that publishes before it fails |
| [0047](adr/0047-scripts-hide-rows-and-derive-no-figures.md) | On a generated status site, scripts hide rows and derive no figures | Cost readers a filter-scoped distribution so every number has exactly one definition - enforced as a property of the rendered output, with the check's three blind spots written down beside it |
| [0012](adr/0012-copy-deployed-sync-services-over-shared-multi-tenant-backend.md) | Per-app copy-deployed sync services over a shared multi-tenant backend | Run N near-identical small services to gain physical blast-radius isolation and per-app sync-model freedom, at the cost of hand-applying shared-auth fixes across copies |
| [0049](adr/0049-expand-contract-entitlements-old-endpoint-kept-reads-fail-open.md) | A closed, provider-independent entitlement state, migrated expand-then-contract, with the old endpoint kept indefinitely and reads failing open | Carry a permanent compatibility endpoint because released desktop builds embed old JavaScript, leave ambiguous legacy rows `unclassified` rather than guess, and give away uploads during my own outage rather than lock out a paying customer |
| [0050](adr/0050-one-conformance-corpus-over-three-hand-written-engines.md) | One language-neutral conformance corpus over three hand-written engines, until a shared core can retire them | Keep implementing every rule three times for now, but make drift mechanical to detect - amend the corpus first, watch three suites go red - and let the same file become the rewrite's acceptance suite |
| [0051](adr/0051-repeatable-llm-judge-over-accurate-one-when-the-verdict-is-cached.md) | A repeatable LLM judge over a more accurate one when the first verdict is cached as precedent | Pick the model with a constant bias over the one with less bias and more noise, because calibration subtracts an offset once and nothing subtracts variance after the cache has frozen it |

### Observability and capacity

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0007](adr/0007-pull-probes-over-push-agents.md) | Pull-based health probing over push agents for a small fleet | Forgo deep metrics/history to keep the monitored fleet agent-free and the failure domain legible |
| [0011](adr/0011-instrumented-metrics-stack-over-bespoke-prober.md) | A pull-based metrics stack over a bespoke prober, data plane kept private | Take on a TSDB to run for real metrics/history/alerting - and bind the unauthenticated parts to loopback, exposing only one read-only pane |
| [0021](adr/0021-shared-collector-seam-over-direct-backend-wiring.md) | A shared OpenTelemetry collector seam over direct backend wiring | Add one collector as the ingestion seam so new telemetry sources and backends are configuration, not new architecture - agent usage metrics only, never prompt content |
| [0022](adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md) | Complete the logs pillar with a co-located local-disk Loki behind the collector seam, over a dedicated or hosted log stack | Add single-binary Loki beside Prometheus/Tempo on the one monitoring node, ingested only through the shared collector seam and bound to localhost - one query surface and native trace-to-logs for near-zero new infrastructure, at the cost of a deeper single-box blast radius and a 31-day local-disk retention ceiling with object storage as the written-down escape hatch |
| [0033](adr/0033-grow-the-disk-and-cap-retention-by-size.md) | Grow the monitoring host's own disk over a block volume, and cap retention by size | Take a one-way, power-off resize because a grandfathered allocation made it free - and accept that the bigger disk is not the guard; the size-based retention cap and log hygiene are |
| [0032](adr/0032-dedicated-host-for-unauthenticated-ingestion-store-private-by-construction.md) | The first unauthenticated-ingestion workload gets its own host; store private by construction; admin gated by a named permission; masking proof per property; abort written before launch | Pay a dedicated small host and a volume so browser-driven POSTs never land beside fleet keys or prod sandboxes, and prove masking by grepping the store for planted strings rather than looking at the player |

## Companion code

- [`observability/`](observability/) - the sanitized Prometheus and
  Alertmanager configuration and Grafana dashboards behind ADR 0011.
- [Tracewake](https://github.com/JacobStephens2/tracewake) - the unattended
  coding loop behind ADRs 0023-0026 and 0036-0039.
- [vaulted-agent](https://github.com/JacobStephens2/vaulted-agent) - the
  runtime-secrets launcher behind ADRs 0018, 0028, and 0048.
- [terraform-cloudflare-dns](https://github.com/JacobStephens2/terraform-cloudflare-dns) -
  the sanitized Terraform, Cloudflare, and Ansible DNS-as-code repo behind ADRs
  0013-0015.

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
