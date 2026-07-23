# Operational review checklist

**Status:** Sanitized. This is the checklist I run against a system before I'll sign off that it's ready to hold real money in production. It's descriptive of what I actually check, not an aspirational compliance list. Items that fail get a fix owner and a date; items that don't apply get one line of rationale, not "N/A."

Format: **Question → What good looks like → Where in this repo → Ownership**.

The ADRs in [`../adr/`](../adr/) explain *why* each pattern exists. This checklist is *what I look for* when reviewing a system that ought to have them.

---

## 1. Blast radius

- [ ] **What can a single compromised credential access?**
  Ideally: exactly one host, one DB user, one purpose. If a credential is portable off its host or reaches more than one tenant's data, that's the finding.
  → [ADR 0009 host-pinned DB access](../adr/0009-default-deny-host-pinned-db-access.md), [ADR 0005 scoped system user](../adr/0005-scoped-system-user-over-service-account.md)

- [ ] **Where is the outer isolation boundary drawn — host, container, network, DB?**
  Ideally: named explicitly. If it's implicit, it's not a boundary.
  → [ADR 0001 container isolation](../adr/0001-docker-over-bare-metal-for-tenant-isolation.md)

- [ ] **Can any automation write directly to the production data plane?**
  Ideally: no. All writes go via a snapshot or a human-gated path.
  → [ADR 0003 periodic snapshot](../adr/0003-periodic-snapshot-over-live-replication.md)

- [ ] **What is the smallest possible action that can take the business offline for a day?**
  If you can't name it in one sentence, you don't yet know your blast radius.

## 2. Restore

- [ ] **When did we last restore from a backup as a rehearsal, not an incident?**
  Ideally: within the last quarter, and after every schema-breaking release. If the last restore was during an outage, that's the finding.

- [ ] **Where does the backup live physically, and who else can delete it?**
  Ideally: on a different provider or account from the primary, with delete-protection or object-lock.
  → [ADR 0015 state off the provider](../adr/0015-state-off-the-provider-it-provisions.md)

- [ ] **What is the documented RTO/RPO, and does the last restore drill match it?**
  Ideally: numbers, not adjectives.
  Actual: `<!-- REVIEW: your numbers here -->`

- [ ] **Is the DB durable and backed up outside its runtime, or is it inside a container that could disappear?**
  Ideally: external managed store, or an operationally-serious self-managed one with tested backups.
  → [ADR 0002 external managed DB](../adr/0002-external-managed-db-over-containerized.md)

## 3. Secrets

- [ ] **How does a running process get its production secrets?**
  Ideally: injected at runtime from a broker or a decrypted-in-memory bundle. Plaintext `.env` on disk is the finding.
  → [ADR 0018 runtime-injected secrets](../adr/0018-runtime-injected-secrets-over-plaintext-config.md)

- [ ] **Where is the encrypted secrets file if applicable, and who holds the private key?**
  Ideally: encrypted at rest with an offline recovery path, and the recovery key isn't held by the same cloud that runs the workload.

- [ ] **Can a compromised container read secrets belonging to another container on the same host?**
  Ideally: no — per-tenant secret scope, injected only into the process that needs it.

- [ ] **Is there any secret in a plaintext env file committed to a repo (including "sanitized" fixtures)?**
  Ideally: no; anything that ever went into a real environment should be treated as rotated regardless of how it's now sanitized. `git log -p` on secrets paths finds these.

## 4. Auth & access

- [ ] **Is SSH exposed on the public internet?**
  Ideally: no. Operator shells reach the fleet via a private mesh; port 22 doesn't answer publicly.
  → [ADR 0020 mesh for shells, MFA for browsers](../adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md)

- [ ] **Do all admin surfaces require phishing-resistant MFA (passkeys / hardware keys)?**
  Ideally: yes. SMS second-factor is deprecated for anyone reachable via the ops surface.

- [ ] **Is there a single "root of trust" session that gates the other admin apps, or is every app its own auth stack?**
  Ideally: one hardened session shared via forward_auth or equivalent, so future hardening lifts every app.
  → [ADR 0019 reuse passkey session for a second app](../adr/0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md)

- [ ] **Is there a scoped, non-shared identity for every automated actor (CI, agent, cron)?**
  Ideally: yes. Shared service accounts are audit-trail black holes.
  → [ADR 0005 scoped system user](../adr/0005-scoped-system-user-over-service-account.md)

## 5. Observability

- [ ] **If a running process starts misbehaving right now, how do I know?**
  Ideally: an alert with a specific condition and a specific route (Alertmanager → paging path). Not "someone will notice."
  → [ADR 0011 instrumented metrics stack](../adr/0011-instrumented-metrics-stack-over-bespoke-prober.md), [`../observability/`](../observability/)

- [ ] **Is there one ingestion seam for telemetry, or does every backend get wired to the app directly?**
  Ideally: one collector; new backends and new sources are configuration, not new code.
  → [ADR 0021 shared collector seam](../adr/0021-shared-collector-seam-over-direct-backend-wiring.md)

- [ ] **Are the private parts of the observability stack (Prometheus, Loki write path, admin panes without auth) reachable from the internet?**
  Ideally: no. Bound to loopback; only a read-only pane (Grafana) exposed, and even that behind the same auth as the rest of the ops surface.

- [ ] **Do agent-usage metrics flow, and does prompt *content* deliberately not?**
  Ideally: yes to the first, yes to the second — the collector's scrub rules make it explicit.

- [ ] **Is there a per-action audit trail that survives a container restart?**
  Ideally: yes; logs are shipped off the container before the container can die.
  → [ADR 0022 co-located Loki behind the seam](../adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md)

## 6. Deploy

- [ ] **How does a change get to production, and who can trigger that path?**
  Ideally: named, auditable, and testable — even if it's a shell script rather than a hosted CI runner.
  → [ADR 0004 guarded shell deploy](../adr/0004-shell-deploy-over-hosted-ci-runner.md)

- [ ] **Are hosts provisioned declaratively, and can I rebuild any of them from Git?**
  Ideally: yes. If a critical host has drift no one can explain, that's the finding.
  → [ADR 0013 staged declarative provisioning](../adr/0013-staged-declarative-provisioning-over-imperative-bootstrap.md)

- [ ] **Is Terraform (or equivalent) state stored on the *same* provider it provisions?**
  Ideally: no. A provider outage that destroys both compute and state is a bad day compounded.
  → [ADR 0015 state off the provider](../adr/0015-state-off-the-provider-it-provisions.md)

- [ ] **Was DNS imported to code, or does the code recreate records that already serve traffic?**
  Ideally: imported. A "just recreate everything" DNS Terraform run is one of the most avoidable outages there is.
  → [ADR 0014 import live DNS](../adr/0014-import-live-dns-over-recreating-it.md)

## 7. Cluster posture (if any)

- [ ] **Is cluster posture enforced at admission, not by review?**
  Ideally: yes. Reviewed and un-reviewed manifests are held to the same bar because the API server rejects both when they violate policy.
  → [ADR 0016 policy-as-code admission](../adr/0016-policy-as-code-admission-over-trusted-manifests.md)

- [ ] **Do workloads run non-root, read-only rootfs, drop all capabilities, with resource requests/limits?**
  Ideally: yes, and the admission policy proves it.
  → [`k3s-demo`](https://github.com/JacobStephens2/k3s-demo) — the reference manifests

- [ ] **Do probes reflect real readiness/liveness, not just "port listens"?**
  Ideally: yes. A probe that passes on a hung app is worse than no probe.

## 8. Agent-specific

- [ ] **Does every consequential agent output pass through a human gate?**
  Ideally: yes, and the gate isn't rubber-stampable at scale — the reviewer has evidence-in-hand (a pixel diff, a summarized DB delta, a preview render) rather than a wall of unstructured text.
  → [ADR 0010 pixel-equality gate](../adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md), [ADR 0017 self-hosted signing](../adr/0017-self-hosted-signing-instrument-over-saas.md)

- [ ] **Is the agent's tool surface enumerated in an allow-list?**
  Ideally: yes; nothing is proxied by default.

- [ ] **Is retrieved / ingested content treated as untrusted?**
  Ideally: yes — inbound email, retrieved web pages, and user-uploaded documents pass through a scrubber for instruction-shaped patterns before entering the context.

- [ ] **Is the LLM provider swappable at config time?**
  Ideally: yes; a price or capability shift is a config change, not a rewrite. Multi-provider is a resilience property, not a feature.

- [ ] **Are agent usage metrics captured (cost, latency, error rate) and reviewed?**
  Ideally: yes; the collector seam makes this a one-shot integration.

## 9. Supply chain

- [ ] **Do the security-sensitive libraries publish an OpenSSF Scorecard?**
  Ideally: yes, badged on the README. It surfaces branch protection, code review, dependency tooling, SAST, signed releases, and token permissions in one line.

- [ ] **Are package releases produced with signed provenance (npm Trusted Publishing / equivalent)?**
  Ideally: yes. Long-lived npm tokens are the finding.

- [ ] **Is the container base image pinned by digest, not by floating tag?**
  Ideally: yes; renovate/dependabot can float the pin under human review.

## 10. Documentation of consequential decisions

- [ ] **Is there an ADR (or equivalent) for every load-bearing choice that a new hire would ask "why did we do it this way?" about?**
  Ideally: yes. If the answer to "why?" lives only in one person's head, that person is a single point of failure.
  → [`../adr/`](../adr/)

- [ ] **Does each ADR state what was given up, not just what was chosen?**
  Ideally: yes. An ADR without a trade-off section is a design note, not a decision record.

- [ ] **Are the ADRs revisited when the trade-offs change?**
  Ideally: yes — a "when I'd revisit" section is on every ADR here.

---

*Written by Jacob Stephens. This is the checklist I actually run — not an aspirational one. If you use it and find a gap, that's the point.*
