# Threat model - Manager Sandbox on a revenue-critical legacy system

**Status:** Sanitized. This is the threat model I use to reason about running semi-autonomous AI agents in Docker-based Manager Sandboxes against a production PHP/MySQL platform whose downtime costs real money. Names, hostnames, credentials, and vendor specifics are omitted.

Format loosely follows [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling): scope → assets → actors → threats → controls → residual risk.

---

## 1. Scope

**In scope**

- A Manager Sandbox: a role-specific instance of the platform running in a Docker container, executing manager-authored tasks against a snapshot of the reservation DB and a scoped subset of the file system.
- The seam between the container and the production data plane - the DB user, the network path, the credential-injection mechanism, and the write path back into production (contract PDFs, itinerary markup, correspondence).
- The human approval gate that sits between an agent-proposed change and any consequential action.

**Out of scope**

- LLM provider-side security (their infrastructure, their prompt-injection filters, their training data). Trust boundary sits at the network egress from the container.
- End-user browser security for the public booking portal - separately modeled.
- Physical security of the host.
- Tracewake is included as a historical comparison: it ran in production in September 2026 and was superseded by thirdshift in October. Its execution boundary and credential inventory are documented below; its scheduler, journal, and dashboard are not. Tracewake-specific controls do not describe thirdshift, which is outside this model.

## 2. Assets

Ordered by consequence.

| # | Asset | Consequence of compromise |
|---|-------|---------------------------|
| A1 | **Production reservation DB (write access)** | Existential business risk. A destructive `UPDATE` or `DELETE` at scale takes bookings offline until the last known-good snapshot is restored - hours to days depending on how long ago the write went unnoticed. |
| A2 | **Signed / generated contracts and invoices** | Legal exposure. A forged or tampered signed PDF sent to a client is a legally-binding document under someone else's authority. |
| A3 | **Personal information** | Regulatory + reputational. Personal information requires access controls and careful handling throughout the platform. |
| A4 | **Third-party API credentials** (payment, email, SMS, LLM providers) | Financial. A leaked payment-provider key writes charges. A leaked LLM key runs up bills and can exfiltrate anything the compromised agent could see. |
| A5 | **Operational continuity** | Any outage that spans the booking-cutoff-to-departure window is unrecoverable - the trip runs or it doesn't. |
| A6 | **Audit trail** | Everything above is downstream of a legible audit trail. Losing per-action attribution turns a recoverable incident into an unbounded one. |

## 3. Actors

| Actor | Motivation | Access surface |
|-------|-----------|----------------|
| **Non-technical operator** (trusted) | Get their work done fast | Browser consoles, agent task authoring, approval gates |
| **Autonomous agent** (partially trusted) | Execute the task it was given | Whatever the sandbox exposes; whatever the harness authorizes |
| **Malicious prompt** (untrusted, arriving as ingested content) | Anything an attacker can encode in text the agent will read | Contract templates, inbound email, itinerary source docs, retrieved web pages |
| **Compromised dependency** (untrusted) | Whatever it was compromised for | Any package pulled into the container image or the harness runtime |
| **External attacker** (untrusted) | Ransom, data exfiltration, reputational | Public admin console, exposed DB port, exposed shell, leaked credential |
| **Insider with legitimate credential** (partially trusted) | Malice or mistake | Everything they're already authorized for; blast radius depends on the boundaries |

## 4. Threats & controls

The threats are ordered by likelihood × consequence. Each maps to one or more controls; the primary ADR reference is in parentheses.

### T1 - Agent (or attacker via agent) executes destructive writes on the production DB
**Consequence:** A1, A5. Existential.

- **Control:** Manager Sandbox writes go to a nightly refreshed **snapshot**, not the production schema. Containers have separate files and processes but share that writable sandbox dataset. Live replication is deliberately not used for this writable copy. ([ADR 0003](../adr/0003-periodic-snapshot-over-live-replication.md))
- **Control:** A separate SELECT-only path reads the production primary under host-pinned grants, account limits, and a server-side query killer. Read-only is not load-free: the time limit is enforced on the server. ([ADR 0057](../adr/0057-a-sandbox-reads-the-primary-not-a-replica-that-can-stall-silently.md))
- **Control:** DB grants are **scoped by user *and* host**. A credential taken out of a container has no reach off that container's host. ([ADR 0009](../adr/0009-default-deny-host-pinned-db-access.md))
- **Control:** The coordination-host agent has a dedicated system identity and host-bound database credentials. Identity provides attribution; actual authority needs a separate review. ([ADR 0005](../adr/0005-scoped-system-user-over-service-account.md))
- **Control:** Container isolation caps filesystem + process reach at the sandbox boundary. ([ADR 0001](../adr/0001-docker-over-bare-metal-for-tenant-isolation.md))
- **Historical Tracewake control:** An unattended iteration ran in a **fresh microVM** with deny-all egress, and the only thing that leaves it is the workspace; push and pull-request creation happen on the host with a token the iteration never held. ([ADR 0023](../adr/0023-attendedness-is-a-fourth-trust-axis.md))
- **Residual risk:** A write that reaches production still relies on the human approval gate. A social-engineered operator who rubber-stamps the gate is the remaining path. Tracewake also required human review before its proposals merged.

### T2 - Prompt injection via ingested content causes the agent to take an action outside the operator's intent
**Consequence:** A1, A2, A3, A4.

- **Control:** Manager Sandbox code changes reach production through pull requests and **engineering review**. Sandbox database experiments remain on the shared writable copy.
- **Related review control:** For visual-preservation work on generated markup, a **pixel-equality assertion** supplies rendered evidence to the reviewer. It proves visual equivalence only; links, accessibility semantics, and behavior need separate checks. ([ADR 0010](../adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md))
- **Related signing pattern:** The self-hosted **signing instrument** in ADR 0017 gates signing on a *named human*. Preparing a document and authorizing its signature are separate actions. ([ADR 0017](../adr/0017-self-hosted-signing-instrument-over-saas.md))
- **Residual risk:** A determined injection that convinces the agent to *not* flag something ambiguous for review is not fully defended by pixel-equality alone. Operator training on "if the agent surprises you, stop" is the human control.

### T3 - Credentials or secrets are leaked from the container to the LLM provider, logs, or an attacker
**Consequence:** A4, cascading to A1–A3.

- **Control:** Covered consumers receive **runtime-injected** secrets from an encrypted source. The team broker and solo fleet's SOPS + age wrapper share that consumer contract; process output requires separate care. ([ADR 0018](../adr/0018-runtime-injected-secrets-over-plaintext-config.md))
- **Control:** The observability collector seam explicitly **does not carry prompt content** - only agent usage metrics (token counts, latency, cost). ([ADR 0021](../adr/0021-shared-collector-seam-over-direct-backend-wiring.md))
- **Historical Tracewake control:** The agent box's credential set was **enumerated and asserted by script** before every dispatch, in both directions - what it must hold, what families it must not - so "what can this box reach?" has an answer that is checked rather than remembered. ([ADR 0024](../adr/0024-asserted-credential-inventory-is-the-isolation-seam.md))
- **Historical Tracewake control:** The model credential inside the boundary was a long-lived token injected by environment (no credential file crosses), and the host **scans the proposal diff for the token pattern and refuses to push** on a match. ([ADR 0025](../adr/0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md))
- **Control:** Secret manifests are **per consumer**, so a vault rename fails the consumer that read it and no other; the validator covers every manifest the machine reads, and fails closed on any it cannot check. ([ADR 0028](../adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md))
- **Control:** User-record audit history **never retains secret values** - who and when remain, values are redacted, and restorable snapshots omit the field. ([ADR 0043](../adr/0043-audit-history-never-retains-secret-values-retroactively.md))
- **Residual risk:** Anything the agent puts *into* a prompt is out of scope for the provider's data handling. Injected credentials can still be exposed by process output; never-print discipline and coverage require separate review.

### T4 - Compromised dependency or malicious LLM tool call reaches a resource it shouldn't
**Consequence:** A1–A4.

- **Control:** OpenSSF Scorecard on the security-sensitive libraries (`webhook-verify`, `webcrypto-envelope`, `muxboard`) surfaces branch-protection, code-review, and signed-release posture as a public badge. Supply-chain surface is minimized further by the "standard-library + zero deps" preference in these libraries.
- **Control:** An unsigned or self-updating executable (an IaC provider plugin, a vendor's agent runner) is **pinned by exact artifact and proven against that pin**; drift from the pin pauses work rather than running. The dependency never becomes the interface. ([ADR 0027](../adr/0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md))
- **Control:** Where the sandbox is layered (systemd hardening, seccomp, AppArmor, Bubblewrap), the confinement is **proved from the live unit**, not from an attended shell that the service could never match. ([ADR 0035](../adr/0035-sandbox-namespaces-under-systemd-hardening-prove-from-the-live-unit.md))
- **Control:** A merge can never expand root-pinned authority on the agent host: automatic promotion switches immutable releases and **reports** drift from the pinned unit files and profiles; only an attended upgrade applies it. ([ADR 0030](../adr/0030-immutable-releases-atomic-promotion-append-only-journal.md))
- **Residual risk:** A compromised LLM provider itself would still exercise every tool the agent is authorized to call. See T2 controls for the human gate.

### T5 - Public admin console is compromised (credential theft, session hijack, phishing)
**Consequence:** A5, cascading everywhere.

- **Control:** Enrolled hosts restrict operator SSH to a **private WireGuard mesh** and the automation source. The fleet-wide reachability check is dated 2026-06-12; later hosts need their own verification. ([ADR 0020](../adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md))
- **Control:** A passkey-protected operations session gates a second browser app via forward_auth rather than standing up a second auth stack. ([ADR 0019](../adr/0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md))
- **Residual risk:** A compromised endpoint device (operator's laptop, malware in the browser) still authenticates as the legitimate operator. MDM + browser-side compensating controls sit outside this repo.

### T6 - Backup/restore path fails when needed
**Consequence:** A1, A5, A6.

- **Control:** Terraform state lives on a **different provider** than the compute it provisions, so a provider-level outage cannot destroy both simultaneously. ([ADR 0015](../adr/0015-state-off-the-provider-it-provisions.md))
- **Control:** External managed DB over containerized (durable, backup-friendly). ([ADR 0002](../adr/0002-external-managed-db-over-containerized.md))
- **Control:** The snapshot pipeline is exercised continuously rather than on a drill calendar: every nightly Manager Sandbox refresh is a snapshot load into a working database ([ADR 0003](../adr/0003-periodic-snapshot-over-live-replication.md)). That proves the snapshot source and the load path. It does not prove a full restore of the primary, which is a separate rehearsal.
- **Residual risk:** A restore that hasn't been tested since a schema migration will surprise you. Restore rehearsals must run *after* every schema-breaking release.

### T7 - Loss of per-action attribution (audit trail gap)
**Consequence:** A6, cascading everywhere.

- **Control:** The coordination-host agent's dedicated system identity attributes its shell actions separately from human sessions. ([ADR 0005](../adr/0005-scoped-system-user-over-service-account.md))
- **Control:** Signing instrument keeps its own signed audit log, gated on a named human per action. ([ADR 0017](../adr/0017-self-hosted-signing-instrument-over-saas.md))
- **Control:** Infrastructure and application logs are shipped through the collector with source identity. Application-level action auditing is checked separately; telemetry presence does not establish complete action coverage.
- **Residual risk:** A gap between the harness's per-action log and the DB's row-level history is where questions land during incident review. Cross-referencing must be scripted, not memory-based.

## 5. Residual risks (what's still yours to own)

The controls above reduce these but do not eliminate them:

- **A human operator who approves a bad change under time pressure.** The pixel-equality gate helps for generated markup; for other categories, operator training and pairing on high-consequence approvals is the compensating control.
- **A prompt injection that persuades the agent to stay silent.** Defense-in-depth via multiple review paths (log + gate + observability) rather than any single filter.
- **A supply-chain compromise upstream of what OpenSSF Scorecard covers** - e.g. a compromised container base image whose vendor was itself compromised. Base-image pinning + SBOM scanning are the compensating controls; both live outside this repo's scope.
- **A schema migration whose restore path is untested.** Rehearse restores after schema breaks.
- **Tracewake's historical signing-key trade-off.** Loop commits were signed with a dedicated key registered to the operator, so a compromised box produces *verified* commits in the operator's name. The key's distinct title and mandatory human review before merge are the compensating controls; the badge is documented as meaning "caused," not "typed." ([ADR 0024](../adr/0024-asserted-credential-inventory-is-the-isolation-seam.md))
- **Tracewake's earlier credential-proxy design.** Under the earlier session-file design, the microVM tool's host proxy took custody of the guest's refreshed OAuth tokens into a host-global store - a second copy of the credential nobody asked for. The long-lived-token design removed the refresh; the lesson is that a sandbox's proxy is part of the credential's blast radius. ([ADR 0025](../adr/0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md))
- **"Attended" can be lost by accident.** A preview instance left running is an unattended one. Lease, banner, and a runtime cap are what keep the distinction honest. ([ADR 0023](../adr/0023-attendedness-is-a-fourth-trust-axis.md))

## 6. When I'd revisit

- After any incident, blameless post-mortem revisits this doc.
- Before adding a new *category* of agent capability (e.g. the first agent that writes to prod DB directly under a specific narrow grant; the first agent that spends money).
- On every major LLM-provider change (new provider, revoked provider, provider-side policy shift).
- On a calendar-driven review regardless of whether anything above fired - threat models rot when nothing forces them to be re-read.

---

*Written by Jacob Stephens. Sanitized for public distribution; the underlying system is not open-source and its private repositories are not linked from here.*
