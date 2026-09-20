# Operational review checklist

**Status:** Sanitized. This is the checklist I run against a system before I'll sign off that it's ready to hold real money in production. It's descriptive of what I actually check, not an aspirational compliance list. Items that fail get a fix owner and a date; items that don't apply get one line of rationale, not "N/A."

Format: **Question → What good looks like → Where in this repo → Ownership**.

The ADRs in [`../adr/`](../adr/) explain *why* each pattern exists. This checklist is *what I look for* when reviewing a system that ought to have them.

---

## 1. Blast radius

- [ ] **What can a single compromised credential access?**
  Ideally: exactly one host, one DB user, one purpose. If a credential is portable off its host or reaches more than one tenant's data, that's the finding.
  → [ADR 0009 host-pinned DB access](../adr/0009-default-deny-host-pinned-db-access.md), [ADR 0005 scoped system user](../adr/0005-scoped-system-user-over-service-account.md)

- [ ] **Where is the outer isolation boundary drawn - host, container, network, DB?**
  Ideally: named explicitly. If it's implicit, it's not a boundary.
  → [ADR 0001 container isolation](../adr/0001-docker-over-bare-metal-for-tenant-isolation.md)

- [ ] **Can any automation write directly to the production data plane?**
  Ideally: no. All writes go via a snapshot or a human-gated path.
  → [ADR 0003 periodic snapshot](../adr/0003-periodic-snapshot-over-live-replication.md)

- [ ] **What is the smallest possible action that can take the business offline for a day?**
  If you can't name it in one sentence, you don't yet know your blast radius.

- [ ] **Can you list every credential on the agent box, and does a script assert the list?**
  Ideally: a short inventory, asserted before every dispatch in both directions (must hold / must not hold). "Three, plus one nobody mentions" is the finding.
  → [ADR 0024 asserted credential inventory](../adr/0024-asserted-credential-inventory-is-the-isolation-seam.md)

- [ ] **If one vault item is renamed, which processes die?**
  Ideally: only the ones that read it. A shared whole-or-nothing manifest that takes down unrelated units is the finding.
  → [ADR 0028 per-consumer manifests](../adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md)

## 2. Restore

- [ ] **When did we last restore from a backup as a rehearsal, not an incident?**
  Ideally: within the last quarter, and after every schema-breaking release. If the last restore was during an outage, that's the finding.

- [ ] **Where does the backup live physically, and who else can delete it?**
  Ideally: on a different provider or account from the primary, with delete-protection or object-lock.
  → [ADR 0015 state off the provider](../adr/0015-state-off-the-provider-it-provisions.md)

- [ ] **What is the documented RTO/RPO, and does the last restore drill match it?**
  Ideally: numbers, not adjectives.
  Actual: write the measured numbers from the last drill here. If there has been no drill, that is the finding.

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
  Ideally: no - per-tenant secret scope, injected only into the process that needs it.

- [ ] **Is there any secret in a plaintext env file committed to a repo (including "sanitized" fixtures)?**
  Ideally: no; anything that ever went into a real environment should be treated as rotated regardless of how it's now sanitized. `git log -p` on secrets paths finds these.

- [ ] **Does the secrets validator cover every manifest the machine reads, and name the file on every line?**
  Ideally: yes, and it fails closed on an entry it cannot check. A validator that prints green because it only walked the manifests something launches from is the finding.
  → [ADR 0028 validate every manifest read](../adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md)

- [ ] **Does any audit trail or change history retain secret values?**
  Ideally: no - who and when are kept, old and new values are redacted, restorable snapshots omit the field.
  → [ADR 0034, consequences](../adr/0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md)

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

- [ ] **Do blocked paths on a legacy webroot answer 404, from an allowlist?**
  Ideally: yes. A blocklist fails open on the next new file; a 403 confirms the file exists.
  → [ADR 0034 root allowlist with 404](../adr/0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md)

- [ ] **Is the admin surface of any unauthenticated-ingestion workload gated by a *named* permission, not "has a session"?**
  Ideally: yes, and the store is on a private address by construction rather than by a firewall rule someone could delete.
  → [ADR 0032 dedicated host, private store](../adr/0032-dedicated-host-for-unauthenticated-ingestion-store-private-by-construction.md)

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
  Ideally: yes to the first, yes to the second - the collector's scrub rules make it explicit.

- [ ] **Is there a per-action audit trail that survives a container restart?**
  Ideally: yes; logs are shipped off the container before the container can die.
  → [ADR 0022 co-located Loki behind the seam](../adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md)

## 6. Deploy

- [ ] **How does a change get to production, and who can trigger that path?**
  Ideally: named, auditable, and testable - even if it's a shell script rather than a hosted CI runner.
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

- [ ] **Do services run from a tree anyone edits in?**
  Ideally: no. The serving checkout is pinned fast-forward-only, refuses and alerts on a dirty tree, and editing happens in worktrees with a stale-path pre-commit hook.
  → [ADR 0029 pinned serving checkout](../adr/0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md)

- [ ] **Can a merge change what root has pinned on the host (unit files, sandbox profiles)?**
  Ideally: no. Automatic promotion switches immutable releases and reports drift; only an attended step applies it. Every promotion attempt is journaled, and the symlink is never hand-edited.
  → [ADR 0030 immutable releases and journal](../adr/0030-immutable-releases-atomic-promotion-append-only-journal.md)

- [ ] **Can the CI deploy credential open a shell on the target?**
  Ideally: no. Forced command installed outside the deployed tree, taking a revision and nothing else; host key pinned in the workflow.
  → [ADR 0031 forced-command deploy key](../adr/0031-ci-deploy-key-restricted-to-one-forced-command-over-host-pull.md)

- [ ] **Is disk growth on stateful hosts capped by retention, not just by disk size?**
  Ideally: a size-based cap on the biggest store plus log hygiene, so a bigger disk isn't the same failure later. And: reclaim space *before* a resize, never after.
  → [ADR 0033 grow the disk, cap by size](../adr/0033-grow-the-disk-and-cap-retention-by-size.md)

## 7. Cluster posture (if any)

- [ ] **Is cluster posture enforced at admission, not by review?**
  Ideally: yes. Reviewed and un-reviewed manifests are held to the same bar because the API server rejects both when they violate policy.

- [ ] **Do workloads run non-root, read-only rootfs, drop all capabilities, with resource requests/limits?**
  Ideally: yes, and the admission policy proves it.

- [ ] **Do probes reflect real readiness/liveness, not just "port listens"?**
  Ideally: yes. A probe that passes on a hung app is worse than no probe.

## 8. Agent-specific

- [ ] **Does every consequential agent output pass through a human gate?**
  Ideally: yes, and the gate isn't rubber-stampable at scale - the reviewer has evidence-in-hand (a pixel diff, a summarized DB delta, a preview render) rather than a wall of unstructured text.
  → [ADR 0010 pixel-equality gate](../adr/0010-pixel-equality-gate-over-diff-review-for-generated-markup.md), [ADR 0017 self-hosted signing](../adr/0017-self-hosted-signing-instrument-over-saas.md)

- [ ] **Is the agent's tool surface enumerated in an allow-list?**
  Ideally: yes; nothing is proxied by default.

- [ ] **Is retrieved / ingested content treated as untrusted?**
  Ideally: yes - inbound email, retrieved web pages, and user-uploaded documents pass through a scrubber for instruction-shaped patterns before entering the context.

- [ ] **Is the LLM provider swappable at config time?**
  Ideally: yes; a price or capability shift is a config change, not a rewrite. Multi-provider is a resilience property, not a feature.

- [ ] **Are agent usage metrics captured (cost, latency, error rate) and reviewed?**
  Ideally: yes; the collector seam makes this a one-shot integration.

- [ ] **When nobody is watching the agent, is it inside a boundary that dies with the iteration?**
  Ideally: yes - fresh microVM per iteration, deny-all egress, workspace is the only thing that comes out, push happens on the host with a token the iteration never held. "It's fine, I'll notice" is the finding for anything unattended.
  → [ADR 0023 attendedness](../adr/0023-attendedness-is-a-fourth-trust-axis.md)

- [ ] **Is the agent runner pinned by digest and proven against that pin before it does real work?**
  Ideally: yes; a self-update or a changed sandbox profile pauses work rather than running.
  → [ADR 0027 pin and prove](../adr/0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md)

- [ ] **Were the sandbox proofs run from the live service unit, or from someone's shell?**
  Ideally: from the unit, under its own systemd/seccomp/AppArmor restrictions. A green proof from a shell certifies nothing about the service.
  → [ADR 0035 prove from the live unit](../adr/0035-sandbox-namespaces-under-systemd-hardening-prove-from-the-live-unit.md)

- [ ] **Could an agent commit its own model token, and would the push refuse?**
  Ideally: the host scans the diff for the token pattern before pushing and fails the proposal on a match.
  → [ADR 0025 model token in the boundary](../adr/0025-long-lived-model-token-in-the-boundary-over-per-iteration-renewal.md)

## 9. Supply chain

- [ ] **Do the security-sensitive libraries publish an OpenSSF Scorecard?**
  Ideally: yes, badged on the README. It surfaces branch protection, code review, dependency tooling, SAST, signed releases, and token permissions in one line.

- [ ] **Are package releases produced with signed provenance (npm Trusted Publishing / equivalent)?**
  Ideally: yes. Long-lived npm tokens are the finding.

- [ ] **Is the container base image pinned by digest, not by floating tag?**
  Ideally: yes; renovate/dependabot can float the pin under human review.

- [ ] **For any dependency that cannot be signature-verified, is the acceptance proof keyed to the exact pin?**
  Ideally: yes; changing version, checksum, or source requires repeating the proof, and a check enforces that rather than convention.
  → [ADR 0027 pin and prove](../adr/0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md)

## 10. Documentation of consequential decisions

- [ ] **Is there an ADR (or equivalent) for every load-bearing choice that a new hire would ask "why did we do it this way?" about?**
  Ideally: yes. If the answer to "why?" lives only in one person's head, that person is a single point of failure.
  → [`../adr/`](../adr/)

- [ ] **Does each ADR state what was given up, not just what was chosen?**
  Ideally: yes. An ADR without a trade-off section is a design note, not a decision record.

- [ ] **Are the ADRs revisited when the trade-offs change?**
  Ideally: yes - a "when I'd revisit" section is on every ADR here.

---

*Written by Jacob Stephens. This is the checklist I actually run - not an aspirational one. If you use it and find a gap, that's the point.*
