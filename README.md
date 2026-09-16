# infrastructure-patterns

Sanitized, generalized write-ups of infrastructure patterns I've designed and
operated in production - distilled into Architecture Decision Records (ADRs)
so the *reasoning* is visible even where the code can't be.

Most of this comes out of running a multi-portal PHP/MySQL reservations
platform plus its surrounding tooling (a Python agent-orchestration host,
Docker-based Manager Sandboxes, a server-side deploy pipeline) as its lead
engineer. Those repositories are private;
these patterns are the parts that generalize, written at the architecture
level - no hostnames, addresses, credentials, or vendor specifics.

## ETA Platform Evidence boundary

- A **Manager Sandbox** is a role-specific Tourbot instance running in a Docker
  container. It gives a manager and AI assistant an isolated place to explore
  data and prototype changes before human-reviewed promotion.
- A **Factory Worker** is one ETA Factory agent attempt running inside a
  short-lived Firecracker microVM. It is not a Manager Sandbox.
- The **Kubernetes Demo** is a separate single-node k3s learning and portfolio
  environment. It is not part of ETA production, and Manager Sandboxes do not
  run on it.
- The **Unattended Loop** is a single-operator coding loop that picks up a
  ticket, runs each agent iteration in a fresh microVM on a dedicated
  low-credential box, and opens a draft pull request with nobody watching. It
  is not a Manager Sandbox and not a Factory Worker; it is the third execution
  plane, and ADRs 0023-0026 are about it.

Most of these patterns cluster on one seam: **safely running autonomous AI
agents against revenue-critical legacy systems**. Per-tenant isolation
([0001](adr/0001-docker-over-bare-metal-for-tenant-isolation.md)), snapshot-fed
writable sandboxes ([0003](adr/0003-periodic-snapshot-over-live-replication.md)),
a scoped agent identity ([0005](adr/0005-scoped-system-user-over-service-account.md)),
and default-deny, host-pinned data access
([0009](adr/0009-default-deny-host-pinned-db-access.md)) are four boundaries
around the same problem: give an agent real production data and real reach
without giving it the ability to damage the business. ADR
[0010](adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md)
covers the legacy-modernization case itself - proving an agent's edits to
opaque, generated markup moved nothing visible before a human is asked to
approve.

A second cluster, ADRs [0023](adr/0023-attendedness-is-a-fourth-trust-axis.md)
through [0027](adr/0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md),
is the *unattended* version of the same problem: when nobody is watching the
agent, which controls survive single-operator scale (a per-iteration microVM
boundary and a short, asserted credential inventory) and which do not (the
rest of the multi-tenant factory).

## Why ADRs

Each decision below is one where a non-obvious trade-off was made and can be
defended. That's the useful unit: not "what I used," but "what I chose, what I
gave up, and when I'd choose differently."

## Decision records

These also read on the web, rendered from this repo, at
[stephens.page/decisions](https://stephens.page/decisions/).

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0001](adr/0001-docker-over-bare-metal-for-tenant-isolation.md) | Docker over bare-metal for per-tenant isolation | Pay image/ops overhead to get strong filesystem + DB-user isolation cheaply |
| [0002](adr/0002-external-managed-db-over-containerized.md) | External managed DB over a containerized one | Give up "one compose up" simplicity for durable, backup-friendly state |
| [0003](adr/0003-periodic-snapshot-over-live-replication.md) | Periodic snapshot over live replication for Manager Sandboxes | Accept some staleness to gain isolation, reset-ability, and no prod write-path risk |
| [0004](adr/0004-shell-deploy-over-hosted-ci-runner.md) | A guarded shell deploy over a hosted CI runner | Forgo ecosystem features for a dependency-free, auditable single-server deploy |
| [0005](adr/0005-scoped-system-user-over-service-account.md) | A scoped system user over a shared service account for an autonomous agent | More host setup in exchange for clean per-action auditing and least privilege |
| [0006](adr/0006-binlog-daemons-over-database-triggers.md) | Binlog-tailing daemons over database triggers for denormalization | Accept eventual consistency to keep derive-logic in versioned code, off the hot write path |
| [0007](adr/0007-pull-probes-over-push-agents.md) | Pull-based health probing over push agents for a small fleet | Forgo deep metrics/history to keep the monitored fleet agent-free and the failure domain legible |
| [0008](adr/0008-embedded-sqlite-over-networked-db-for-tooling.md) | Embedded SQLite over a networked DB for single-node tooling | Give up cross-host sharing for zero operational surface on state one process owns |
| [0009](adr/0009-default-deny-host-pinned-db-access.md) | Default-deny, host-pinned DB access over a trusted network | Take on provisioning friction so a leaked credential isn't portable off its host |
| [0010](adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md) | A pixel-equality gate over diff review for changes to generated markup | Pay a render/diff harness to safely change markup you can't audit by eye - it proves visual, not semantic, equality |
| [0011](adr/0011-instrumented-metrics-stack-over-bespoke-prober.md) | A pull-based metrics stack over a bespoke prober, data plane kept private | Take on a TSDB to run for real metrics/history/alerting - and bind the unauthenticated parts to loopback, exposing only one read-only pane |
| [0012](adr/0012-copy-deployed-sync-services-over-shared-multi-tenant-backend.md) | Per-app copy-deployed sync services over a shared multi-tenant backend | Run N near-identical small services to gain physical blast-radius isolation and per-app sync-model freedom, at the cost of hand-applying shared-auth fixes across copies |
| [0013](adr/0013-staged-declarative-provisioning-over-imperative-bootstrap.md) | Staged declarative provisioning (Terraform + cloud-init + separate deploy) over one imperative bootstrap script | Take on Terraform state and a deliberately create-only provisioning token for a single box to get a reproducible, reviewable host and a clean provision/configure/deploy seam |
| [0014](adr/0014-import-live-dns-over-recreating-it.md) | Import ~220 live DNS records into Terraform over recreating them from a desired-state list | Accept verbose generated config and provider quirks to adopt traffic-serving records with zero downtime and a no-op baseline plan, instead of risking duplicate-creates and silent deletion of forgotten records |
| [0015](adr/0015-state-off-the-provider-it-provisions.md) | Keep Terraform state on a different provider than the compute it provisions | Take on a second vendor + scoped IAM key so a provider-level outage can't destroy both the infrastructure and the state needed to rebuild it |
| [0016](adr/0016-policy-as-code-admission-over-trusted-manifests.md) | Enforce cluster posture at admission (OPA/Gatekeeper + a VAP) over trusting reviewed manifests | Run a policy controller so the hardened posture is rejected-if-violated at the API server instead of relying on review - the control that matters once a second actor or an agent can apply to the cluster |
| [0017](adr/0017-self-hosted-signing-instrument-over-saas.md) | Self-host the signing instrument and its audit trail over a SaaS signature service | Take on one container plus its own cert and upkeep so the legally-binding document and its audit trail stay on infra you govern, with a named-human gate on every consequential action - the highest-stakes case of keeping the authoritative copy where you control it |
| [0018](adr/0018-runtime-injected-secrets-over-plaintext-config.md) | Runtime-injected secrets over plaintext config, with the store matched to the team | Hold one invariant (encrypted at rest, injected into the environment at runtime) and pay for two backends - a broker where a team needs sharing/revocation/audit, SOPS + age where a solo fleet needs offline zero-vendor recovery - rather than force one tool to fit both |
| [0019](adr/0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md) | Reuse an existing passkey session to gate a second app (Caddy forward_auth) over standing up a second auth stack | Gate a second internal app by delegating to one hardened passkey session via Caddy forward_auth - ~40 lines of Caddyfile, zero new auth code, every tool inheriting the gate's future hardening - at the cost of concentrating trust in a single session |
| [0020](adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md) | A private mesh for operator shells, public MFA-gated endpoints for browser consoles, over one VPN for everything | Put SSH behind a WireGuard mesh and drop public :22, but keep browser admin consoles public behind per-audience MFA - size the boundary to who uses it, rather than hide the consoles non-technical staff reach by URL behind a VPN client they can't maintain |
| [0021](adr/0021-shared-collector-seam-over-direct-backend-wiring.md) | A shared OpenTelemetry collector seam over direct backend wiring | Add one collector as the ingestion seam so new telemetry sources and backends are configuration, not new architecture - agent usage metrics only, never prompt content |
| [0022](adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md) | Complete the logs pillar with a co-located local-disk Loki behind the collector seam, over a dedicated or hosted log stack | Add single-binary Loki beside Prometheus/Tempo on the one monitoring node, ingested only through the shared collector seam and bound to localhost - one query surface and native trace-to-logs for near-zero new infrastructure, at the cost of a deeper single-box blast radius and a 31-day local-disk retention ceiling with object storage as the written-down escape hatch |
| [0023](adr/0023-attendedness-is-a-fourth-trust-axis.md) | Attendedness is a fourth trust axis: a per-iteration microVM boundary for unattended agents, even at single-operator scale | Re-earn exactly one subsystem - the execution boundary - because "I notice and fix" is the premise that lets solo-scale isolation collapse, and an unattended run is defined by nobody noticing; everything else in the heavy factory stays deleted |
| [0024](adr/0024-asserted-credential-inventory-is-the-isolation-seam.md) | A short, script-asserted credential inventory on the agent box; the inventory, not the network hop, is the isolation seam | Three base credentials plus one repo token per target, asserted in both directions before every dispatch - so the box's reach is enumerable, single-host mode is gated on passing the same check, and every "just add a mail credential" reopens the two lists whose value is being short |
| [0025](adr/0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md) | The model credential inside the boundary: a long-lived subscription token by environment, over per-iteration renewal or a metered key | Keep the flat-rate cost control and give up proxy-injected isolation - bounded instead by deny-all egress, a sandbox that dies per iteration, a token that revokes alone, and a diff scan that refuses to push the token pattern |
| [0026](adr/0026-one-boundary-harness-vendor-facts-in-the-leaf.md) | The agent is a substitutable command: one boundary harness, vendor facts in a leaf | Pay a harness/leaf split and double-asserted structural tests so the loop is a claim about a technique rather than a vendor, and a third agent is a leaf, not a second copy of the lifecycle |
| [0027](adr/0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md) | Enroll an unsigned third-party executable by pinning the exact artifact and keying its acceptance proof to the pin | Accept an unsignable IaC provider and a self-updating agent runner by pinning bytes, proving the pin with a real lifecycle, refusing work until the proof matches the installed pin, and never letting the dependency be the interface - a false pause is recoverable, a silently dropped boundary is not |
| [0028](adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md) | One secret manifest per consumer, generated from a tracked declaration; validate every manifest the machine reads | Take on a generator, a startup assertion, and a constants file so a vault rename kills one consumer instead of the box - after a 252-reference shared manifest took down four units for six hours while the validator printed green |
| [0029](adr/0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md) | Pin the shared serving checkout fast-forward-only, refuse-and-alert on a dirty tree, edit only in worktrees | Give up "restart and it's live" on one service to stop the inverted-signal failure where the newest commit carries the oldest content - the pin is a detector, the default worktree and a stale-path pre-commit hook are the barrier |
| [0030](adr/0030-immutable-releases-atomic-promotion-append-only-journal.md) | Immutable per-commit releases, atomic promotion, an append-only journal; re-promotion is a named attended operation; root-pinned authority drift is reported, never a failure | Pay a promoter and a journal so no exit leaves production unnamed, hand-editing the symlink is the thing the design refuses, and a merge can never expand what root pinned - drift is shown, not paged |
| [0031](adr/0031-ci-deploy-key-restricted-to-one-forced-command-over-host-pull.md) | A CI deploy key that reaches a shared host, restricted to one installed forced command, over having the host pull | Let a CI secret reach a host that serves client work because it cannot open a shell - forced command outside the deployed tree, pinned host key - in exchange for sub-minute deploys without a listener or a timer |
| [0032](adr/0032-dedicated-host-for-unauthenticated-ingestion-store-private-by-construction.md) | The first unauthenticated-ingestion workload gets its own host; store private by construction; admin gated by a named permission; masking proof per property; abort written before launch | Pay a dedicated small host and a volume so browser-driven POSTs never land beside fleet keys or prod sandboxes, and prove masking by grepping the store for planted strings rather than looking at the player |
| [0033](adr/0033-grow-the-disk-and-cap-retention-by-size.md) | Grow the monitoring host's own disk over a block volume, and cap retention by size | Take a one-way, power-off resize because a grandfathered allocation made it free - and accept that the bigger disk is not the guard; the size-based retention cap and log hygiene are |
| [0034](adr/0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md) | A strict root allowlist returning 404 over a growing blocklist returning 403, for a legacy repository-as-webroot | Fail closed against files nobody anticipated and stop confirming their existence to scanners, without the multi-quarter refactor of moving the document root - which the allowlist now guards |
| [0035](adr/0035-sandbox-namespaces-under-systemd-hardening-prove-from-the-live-unit.md) | Let the hardened service create namespaces so the sandbox can confine the model; hold the boundary in AppArmor; prove from the live unit | Loosen one systemd restriction that no narrower setting can express, keep the kernel and profile layers that make it safe, and never again certify a sandbox from an attended shell that the service could not start |

A concrete, sanitized companion to ADR 0011 lives in
[`observability/`](observability/): the Prometheus/Alertmanager config and
Grafana dashboards that make the pattern reproducible. A companion to ADRs
0013-0015 - the full Terraform/Cloudflare/Ansible DNS-as-code repo, sanitized -
lives at
[terraform-cloudflare-dns](https://github.com/JacobStephens2/terraform-cloudflare-dns).
The runtime-secrets launcher that ADRs 0018 and 0028 describe - manifest
validation over every file a machine reads - lives at
[vaulted-agent](https://github.com/JacobStephens2/vaulted-agent).
The unattended loop behind ADRs 0023-0026 lives at
[tracewake](https://github.com/JacobStephens2/tracewake).
A companion to ADR 0016 - the separate, non-production Kubernetes Demo whose
posture the policy set enforces - lives at [k3s-demo](https://github.com/JacobStephens2/k3s-demo)
(`k3s-demo.stephens.page`), with the manifests under
[`policy/`](https://github.com/JacobStephens2/k3s-demo/tree/main/policy).

## Companion artifacts

The ADRs answer *why*. These sit alongside them to answer *how it all fits together*:

- **[`case-study/`](case-study/)** — a sanitized end-to-end write-up of the specialty-travel platform these patterns come from: what the system looked like before, which ADRs tied together to modernize it under agents without a rewrite, and what generalizes.
- **[`threat-model/agent-sandbox.md`](threat-model/agent-sandbox.md)** — the threat model I use to reason about running semi-autonomous AI agents against a revenue-critical legacy system: scope, assets, actors, threats, controls (mapped to specific ADRs), and residual risks. Loosely follows [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling).
- **[`checklist/operational-review.md`](checklist/operational-review.md)** — the operational-review checklist I actually run before signing off that a system is ready to hold real money in production: blast radius, restore, secrets, auth, observability, deploy, cluster posture, agent-specific, supply chain, and decision documentation.

## Format

Each ADR uses a short, consistent shape: **Context → Decision → Consequences →
When I'd revisit**. They're deliberately terse.
