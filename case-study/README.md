# Case study — a specialty-travel platform, modernized under agents

**Status:** Sanitized. Names, hostnames, tenant identifiers, credentials, and vendor specifics have been removed or generalized. Financial magnitudes are approximate and rounded. Where a section still needs owner sign-off before publishing, it is marked `<!-- REVIEW: ... -->`.

A companion to the ADRs in [`../adr/`](../adr/). ADRs answer *"what did you decide, and why."* This case study answers *"what did the system look like before, what does it look like now, and what changed that mattered."*

---

## Three environments, three purposes

- A **Manager Sandbox** is a role-specific Tourbot instance running in a Docker
  container. Managers use these isolated copies to explore data and prototype
  changes before human-reviewed promotion.
- A **Factory Worker** is one ETA Factory agent attempt running inside a
  short-lived Firecracker microVM. Factory Workers are separate from Manager
  Sandboxes.
- The **Kubernetes Demo** is a separate single-node k3s learning and portfolio
  environment. It is not part of ETA production, and Manager Sandboxes do not
  run on it.

## The system before

A ~15-year-old multi-portal reservations, itinerary, and back-office platform for a specialty travel operator — hundreds of thousands of dollars per booking, revenue-critical, on the same PHP/MySQL stack it was written on.

- **Portals:** four browser applications sharing one MySQL schema — a booking portal for the public, a leader/traveler portal, an internal ops console, and a finance console.
- **State:** MySQL 8.4 as the source of truth; roughly `<!-- REVIEW: replace with sanitized row/table counts -->` in the reservations and audit tables.
- **Runtime:** a single virtualized host, deploy-in-place, no CI, no observability beyond MySQL slow-query logs and a nightly cron report.
- **Ops posture:** shared credentials in plaintext config, DB reachable from any host that resolved its name, all SSH on port 22, no MFA on any admin console, backups run by a cron and hoped over.
- **Team:** one full-time engineer + occasional contractor; a handful of non-technical operators who administered the business through the browser consoles daily.

The system worked. It was also one shared credential, one misclick, or one enthusiastic AI agent away from an outage that would have taken the business down for the week between booking cutoff and departure. The rewrite everyone wanted was not going to happen — the domain logic in the schema and the PHP procedures is the business, and no one was funding a two-year rebuild.

## The problem statement

Modernize the platform without a rewrite. Add AI-assisted automation for the operator-facing work (itinerary composition, contract generation, correspondence, invoicing). Do it without letting the automation, or the humans configuring it, take down the reservation system.

That constraint — *safe AI automation for revenue-critical legacy systems* — is the thread the ADRs all sit on.

## The changes that mattered

Each of these is written up as an ADR; the case-study framing is what tied them together.

### 1. Manager Sandboxes in Docker over bare-metal

Each Manager Sandbox is a role-specific Tourbot instance running inside a Docker container with its own filesystem, scoped MySQL user, and scoped system identity. Blast radius stops at the container. See [ADR 0001](../adr/0001-docker-over-bare-metal-for-tenant-isolation.md), [ADR 0005](../adr/0005-scoped-system-user-over-service-account.md).

### 2. Snapshot-fed Manager Sandboxes over live replication

Agents in Manager Sandboxes get realistic data to reason over, but they write into a periodically-refreshed snapshot of the schema — never the primary. A destructive write is a re-snapshot away from erased. See [ADR 0003](../adr/0003-periodic-snapshot-over-live-replication.md).

### 3. Default-deny, host-pinned DB access over trusted network

Every DB grant is scoped by user *and* host. A credential exfiltrated from a container is portable to nothing. See [ADR 0009](../adr/0009-default-deny-host-pinned-db-access.md).

### 4. Pixel-equality gate over diff review for generated markup

Legacy templates emit opaque, machine-generated markup no reviewer can eye-diff safely. An agent edit is gated by a headless-browser render of the before/after and a pixel-perfect equality assertion — the human is asked to approve *only* changes that moved zero pixels. See [ADR 0010](../adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md).

### 5. Factory Workers in short-lived Firecracker microVMs

Each ETA Factory agent attempt is a Factory Worker running inside a short-lived Firecracker microVM, on a separate execution plane from the Docker-based Manager Sandboxes.

### 6. Kubernetes Demo as separate, non-production evidence

The Kubernetes Demo is a single-node k3s learning and portfolio environment, not ETA production. Its policy layer enforces workload posture at admission so reviewed and unreviewed manifests are held to the same bar. It demonstrates Kubernetes operations without claiming that Manager Sandboxes or Factory Workers run there. See [ADR 0016](../adr/0016-policy-as-code-admission-over-trusted-manifests.md).

### 7. Private mesh for operator shells, MFA-gated public endpoints for browser consoles

SSH left the public internet entirely; browser admin consoles that non-technical operators reach by URL stayed public but got MFA in front of them. See [ADR 0020](../adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md).

### 8. Runtime-injected secrets over plaintext config

Two backends for two audiences — a broker for shared team secrets, SOPS + age for the solo-operated fleet — but one invariant: encrypted at rest, injected at runtime. See [ADR 0018](../adr/0018-runtime-injected-secrets-over-plaintext-config.md).

### 9. Observability behind one collector seam

Prometheus + Tempo + Loki behind a shared OpenTelemetry collector, private data plane bound to loopback, only a read-only Grafana surface exposed. Agent *usage* metrics only — prompt contents never crossed the seam. See [ADR 0021](../adr/0021-shared-collector-seam-over-direct-backend-wiring.md), [ADR 0022](../adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md).

## Outcomes

<!-- REVIEW: replace with specific, sanitized outcome numbers where you're comfortable — booking downtime avoided, mean-time-to-recover on a prod incident, agent-hours/week added, number of merged agent PRs on the legacy templates, etc. Rounded and approximate is fine; specific-and-defensible reads better than generic. -->

- **Zero production-data incidents** caused by agent activity across `<!-- REVIEW: N months -->` of operation.
- **`<!-- REVIEW: X agent-hours/week -->`** of operator work now handled by the automation, gated by human approval on every consequential action.
- **Mean provisioning time** for a new Manager Sandbox dropped from `<!-- REVIEW: days -->` to `<!-- REVIEW: hours -->`, because the container definition, scoped DB user, and deploy path are repeatable.
- **`<!-- REVIEW: N -->`** distinct AI models integrated behind one internal API — swappable at config time — so a provider-side price change or capability shift is a config, not a rewrite.
- **Compliance posture:** MFA on all admin consoles, no plaintext secrets in config, all admin shells behind a WireGuard mesh, full audit trail per named human on every signing action.

## What I'd do differently

- **Adopt the policy layer earlier.** ADR 0016 landed after the Kubernetes Demo was live. Every day between "demo running" and "admission policy enforcing" was a day when a reviewed-but-imperfect manifest could ship a regression. Enforce posture from day one.
- **Cut a second observability landing zone sooner.** ADR 0021's collector seam was designed for exactly this — but I waited to add a second backend until we needed it. In hindsight, having the redundancy from the start would have made a couple of debugging sessions much shorter.
- **Formalize the human-in-the-loop protocol earlier.** The pixel-equality gate (ADR 0010) is the pattern; the same shape should have shown up for the signing instrument (ADR 0017) and the contract-generation agents from day one instead of arriving as a retrofit.

## What generalizes

The ADRs generalize; this specific system doesn't need to. If you are:

- running a decades-old line-of-business system that funds the payroll
- being asked to add AI-assisted automation on top
- unable or unwilling to fund the rewrite

then these patterns — sandbox first, snapshot the state, host-pin the credentials, gate the writes on evidence a human can accept, put policy at admission, and keep the human on the consequential decisions — are the seam you're looking for.

---

*Written by Jacob Stephens. Sanitized for public distribution; the underlying system is not open-source and its private repositories are not linked from here.*
