# ADR 0017 - Self-host the signing instrument and its audit trail over a SaaS signature service

**Status:** Accepted · in production (`sign.stephens.page`, Documenso v2.11.0)

## Context

A small business needs to send a proposal and get it signed. The default answer is
a SaaS e-signature service - DocuSign, Dropbox Sign, or Documenso's own hosted tier.
Click through a vendor, upload the PDF, send the link. It works, and for most teams
it is the right call.

It also means the one document that is *legally binding* - the signed instrument and
the audit trail that proves who signed it, when, and from where - lives on someone
else's infrastructure, under their retention policy, their breach exposure, and their
ability to change terms or disappear. The signed proposal is the contract. The audit
log is the evidence if the contract is ever contested. Handing both to a third party
is a defensible convenience for low-stakes documents and a quiet abdication for
consequential ones, and "consequential" is exactly the category a signature exists
to mark.

This is the same class of decision the rest of this repo keeps making: where does the
authoritative copy of a thing that matters live, and who can touch it. ADR 0002 keeps
the database off the application container; ADR 0009 pins database access default-deny
to named hosts; ADR 0015 keeps Terraform state off the provider it provisions. A
signature is the highest-stakes instance of the pattern - the artifact whose whole
purpose is non-repudiation - so it gets the same treatment.

## Decision

**Self-host the signing service so the signed instrument and its audit trail never
leave infrastructure I control, and gate every consequential action behind a named
human.** Use Documenso (open-source, AGPL) rather than build, because the signing
cryptography and the audit log are exactly the parts you do not want a solo author
reimplementing.

- **One container, reusing the host Postgres - not the bundled-Postgres Compose
  stack.** Documenso ships only Docker-supported install paths, so this is the first
  container on an otherwise systemd+Apache fleet - a deliberate, single, contained
  exception, not a migration of anything else. The official quick-start runs a second
  Postgres in its own container (~2 GB RAM); instead the single container points at
  the existing Postgres 16 over the Docker bridge, consistent with ADR 0002's
  external-DB posture and keeping the footprint in the ~1 GB tier (observed 267 MB).
- **Database access is scoped the way ADR 0009 scopes it.** A dedicated `documenso`
  role owns one `documenso` database and nothing else; `pg_hba.conf` admits that role,
  to that database, only from the Docker bridge subnet (`172.17.0.0/16`), `scram-sha-256`.
  `listen_addresses` was widened from `localhost` to `localhost,172.17.0.1` - the
  bridge gateway only, never a public interface. The container reaches it via
  `host.docker.internal`.
- **The app never touches the public network directly.** It binds `127.0.0.1:3478`;
  Apache reverse-proxies it behind Let's Encrypt TLS at `sign.stephens.page`, the same
  pattern every other service on the fleet uses. With the host firewall inactive, host
  networking would have exposed the app port, so bridge networking with a loopback
  publish is load-bearing, not cosmetic.
- **The signature is cryptographic and the key is local.** A password-protected
  RSA-2048 `.p12` signs each completed PDF; the passphrase lives in a `chmod 600`
  env file, the key file is `chmod 400` owned by the container UID. Documenso records
  a per-document event log and emits a completion certificate. The signed artifact and
  its evidence are produced and stored on the box.
- **Telemetry off; uptime pulled, not pushed.** `DOCUMENSO_DISABLE_TELEMETRY=true`,
  so usage data stays local too. The service is a blackbox probe target in the fleet
  Prometheus (ADR 0007, ADR 0011), so its liveness is monitored without an agent
  inside it.

## Consequences

- **The contract and its evidence are mine to govern.** Retention, deletion, export,
  and breach exposure are decisions I make, not terms I accept. If the proposal is
  ever contested, the audit log is on infrastructure I can attest to.
- **Self-signed means "valid but not CA-chained."** The signature is cryptographically
  sound and tamper-evident, but PDF readers show "signature validity unknown" because
  the cert chains to no public CA. For a proposal between parties who already know each
  other, that is fine and is disclosed in the cover note. It is the explicit thing to
  fix before this is used for documents signed with strangers.
- **One container is now mine to keep current.** A pinned image (`v2.11.0`), a signing
  cert with an expiry (825 days), and Documenso's own release cadence are real upkeep.
  Accepted because the alternative - the binding document on a vendor's terms - is the
  cost this ADR exists to refuse.
- **Reusing the host Postgres widened its listener.** `listen_addresses` now includes
  the bridge gateway. Bounded by the role/database/subnet scoping above, so the new
  surface is one role reaching one database from one private subnet, but it is a real
  change to shared infrastructure and is called out rather than left implicit.

## When I'd revisit

If the document volume or counterparty risk rises - signing with parties who are not
already known, anything a court might weigh - the self-signed cert is the first thing
to replace, with a CA-issued or eIDAS/AATL-chained certificate swapped in at the same
env var, no architecture change. And if this stops being one business's signing line
and becomes a service others depend on, the single-container, single-host posture is
no longer enough: it would want the bundled durable storage, backups of the document
store as well as the database, and a second node - at which point the convenience case
for a managed signing service has to be re-argued honestly against the sovereignty case
this ADR makes, not assumed to lose.

---

## Seventh-boundary appendix

*Every signature-system narrative and every ADR bridging to the new toolchain carries
this appendix. It asks who is affected upstream and downstream of the automation, not
only how it behaves.*

- **(a) Upstream provenance.** The signing path is open-source with public provenance:
  Documenso (AGPL), Postgres, OpenSSL for the certificate, Apache and Let's Encrypt for
  transport - no opaque model or hidden-labor dependency sits in the act of signing.
  Documenso's product telemetry is disabled, so no usage data leaves the host. Where an
  AI assistant helped author this ADR and the deployment, that is disclosed here; the
  signing cryptography and the audit log are standard, inspectable components, not a
  vendor black box.

- **(b) Human-displacement assessment.** This displaces a *clerical task* - printing,
  wet-signing, scanning, mailing - not a person's role. It moves toward *augmentation*:
  the signer gets a faster, auditable path and a copy of the evidence, and no one's
  judgment about *whether* to sign is automated. The failure mode to guard against is
  using the frictionlessness to rush a counterparty past informed consent; the
  mitigation is that the audit log records what was presented and when, so the act
  stays reconstructable and contestable rather than merely fast.

- **(c) Not delegated.** No automated process - no cron sweep, no future agent with
  access to this box - may send a document for signature, countersign on the
  business's behalf, void or alter a signed instrument, or change a recipient, without
  a named human initiating it. The software may *transport and record* a signing
  decision; it may never *make* one. Drafting the terms, deciding to send, and deciding
  to sign are human acts behind a human gate, and the audit trail exists precisely so a
  harmed party has a path to challenge an automated output - the default-deny,
  named-human-gate model the boundary checklist requires.
