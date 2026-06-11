# infrastructure-patterns

Sanitized, generalized write-ups of infrastructure patterns I've designed and
operated in production - distilled into Architecture Decision Records (ADRs)
so the *reasoning* is visible even where the code can't be.

Most of this comes out of running a multi-portal PHP/MySQL reservations
platform plus its surrounding tooling (a Python agent-orchestration host,
per-tenant containerized AI sandboxes, a server-side deploy pipeline) as its
lead engineer. Those repositories are private;
these patterns are the parts that generalize, written at the architecture
level - no hostnames, addresses, credentials, or vendor specifics.

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

## Why ADRs

Each decision below is one where a non-obvious trade-off was made and can be
defended. That's the useful unit: not "what I used," but "what I chose, what I
gave up, and when I'd choose differently."

## Decision records

| # | Decision | Trade-off in one line |
|---|----------|------------------------|
| [0001](adr/0001-docker-over-bare-metal-for-tenant-isolation.md) | Docker over bare-metal for per-tenant isolation | Pay image/ops overhead to get strong filesystem + DB-user isolation cheaply |
| [0002](adr/0002-external-managed-db-over-containerized.md) | External managed DB over a containerized one | Give up "one compose up" simplicity for durable, backup-friendly state |
| [0003](adr/0003-periodic-snapshot-over-live-replication.md) | Periodic snapshot over live replication for sandboxes | Accept some staleness to gain isolation, reset-ability, and no prod write-path risk |
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

A concrete, sanitized companion to ADR 0011 lives in
[`observability/`](observability/): the Prometheus/Alertmanager config and
Grafana dashboards that make the pattern reproducible. A companion to ADRs
0013-0015 - the full Terraform/Cloudflare/Ansible DNS-as-code repo, sanitized -
lives at
[terraform-cloudflare-dns](https://github.com/JacobStephens2/terraform-cloudflare-dns).
A companion to ADR 0016 - the live k3s deployment whose posture the policy set
enforces - lives at [k3s-demo](https://github.com/JacobStephens2/k3s-demo)
(`k3s-demo.stephens.page`), with the manifests under
[`policy/`](https://github.com/JacobStephens2/k3s-demo/tree/main/policy).

## Format

Each ADR uses a short, consistent shape: **Context → Decision → Consequences →
When I'd revisit**. They're deliberately terse.
