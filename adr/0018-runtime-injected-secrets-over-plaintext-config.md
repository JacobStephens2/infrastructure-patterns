# ADR 0018 - Runtime-injected secrets over plaintext config, with the store matched to the team

**Status:** Accepted · in production on two fleets · broker half verified in situ (2026-06)

## Context

The default place a credential ends up is a plaintext file: a `.env` next to the
app, a token pasted into a config, a connection string in a shell script. Every
copy is a liability - it leaks through disk images, backups, a stray `cat`, a
repository that was supposed to stay private. And the file is only half the
problem: a secret that sits in a process's config for its whole lifetime is
readable by everything that can read that process's directory, forever, whether
or not the process is using it.

I operate two production fleets with different shapes. One is team-operated: a
small business's platform where several people and an autonomous coding agent
need credentials, people join and leave, and a revoked key has to actually die.
The other is solo-operated: a personal server fleet where I am the only
operator, there is no seat budget, and the recovery story has to work offline
with no vendor in the loop. One secret-management answer does not fit both -
but one *invariant* does.

## Decision

**Secrets are injected into the process environment at runtime from an
encrypted store, never read from plaintext at rest - and the store is chosen
per operational context.** The consumer contract is environment variables; no
consumer knows or cares which backend produced them.

- **Team fleet: a managed broker (1Password).** Credentials live in the vault;
  `op inject` resolves a checked-in template of `op://` references (references
  in git, values never) into the consuming process's environment - for the
  lifetime of that process, with long-lived consumers re-injecting at restart.
  One template feeds both consumer shapes on the box: a systemd service renders
  it in `ExecStartPre` to a tmpfs runtime file (re-resolved every unit start,
  wiped on reboot), and the interactive agent launcher exports it env-only at
  session launch. The template doubles as the reviewable inventory of
  everything the machine identity can receive. The broker earns its
  subscription where a team exists: sharing without chat-pasting, central
  revocation when a person or machine is offboarded, rotation in one place
  (exercised - the bootstrap token has been rotated twice; consumers picked it
  up at next launch), and an access log (offered by the broker; not yet
  consumed on this fleet). The autonomous coding agent gets its credentials the
  same vault-injected way, and the injection path writes nothing to its sandbox
  filesystem - but injected values are inherited by every child process, and
  session transcripts persist to disk, so the never-print discipline is part of
  the control, not a property of the mechanism.
- **Solo fleet: file-based encryption (SOPS + age).** Each secret file is
  encrypted to an age key (`*.env.sops`); a ~15-line `secret-env` wrapper
  decrypts one file into one command's environment and `exec`s it. systemd
  units call the same wrapper. Free, offline, no third party at decrypt time,
  and ciphertext is safe in backups. The one irreplaceable artifact is the age
  private key, which is backed up out-of-band; every secret behind it is
  re-mintable from the issuing service, so a lost key is an annoyance, not a
  catastrophe.
- **The seam is the point.** Because consumers only see environment variables,
  the backend is swappable behind the wrapper. The solo fleet proved it: it ran
  for years on mode-600 plaintext `.env` files sourced per-command, and the
  upgrade to SOPS touched one wrapper and two systemd units - zero consumers.
  The same seam is the migration path to a broker if the context ever changes.
- **Scoping survives the abstraction - and its real unit is the vault.**
  Broker side, the machine identity is a dedicated service account confined to
  a single vault, fully separate from human seats; injection granularity
  differs per consumer on the same box (per-unit-start for the service,
  per-session - days - for the agent). File side, each `.env.sops` holds one
  service's credentials, tokens are minted least-privilege (a read-only token
  and an edit token are separate files), and the runbooks write new tokens
  straight into ciphertext - no plaintext step to forget.

## Consequences

- **A leaked disk, backup, or transcript exposes ciphertext, not credentials.**
  The class of accident the plaintext default invites - the stray `cat`, the
  file in the wrong tarball - now discloses nothing. (Honestly qualified:
  in-situ verification found two legacy plaintext env files on the team fleet
  still awaiting vault migration, marked as such. An adopted invariant has
  residue; finding and naming it is what the verification pass is for.)
- **Two backends is more honest than one, and costs a second mental model.**
  The broker's audit log and revocation have no SOPS equivalent; SOPS's
  offline, zero-vendor recovery has no broker equivalent. Pretending one tool
  fits both fleets would trade a real property away on one of them.
- **Neither defeats a compromised operator account.** On the solo fleet the
  age key is readable by the operating user, so an attacker with that shell
  can decrypt; the broker still needs a bootstrap credential on the box for
  non-interactive use (a root-owned, group-readable env file) - and that token
  rides in the agent's environment, making the agent a broker *client*, not
  merely a downstream consumer. Both choices *concentrate and harden* the root
  of trust - they do not eliminate it. Naming that is part of the decision.
- **The broker is a runtime dependency; the files are not.** A broker outage
  or expired seat blocks injection on the team fleet - and the launcher is
  deliberately fail-closed, refusing to start a consumer with an empty
  environment rather than degrading, so an outage gates new launches and
  restarts while already-running consumers coast on their injected
  environment. The solo fleet decrypts with no network at all. Each fleet got
  the failure mode it can afford.
- **Rotation asymmetry.** Broker rotation is one update, consumers pick it up
  on next injection. SOPS rotation means re-encrypting files and, for the age
  key itself, re-keying every file - acceptable at solo scale, painful beyond
  it.

## When I'd revisit

The selection criterion is the team, so the trigger is the team changing. A
second regular operator on the solo fleet - or an agent whose secret access
needs per-read audit - tips it to a broker; the `secret-env` seam makes that a
wrapper swap, not a migration. Conversely, if the team fleet ever had to shed
its SaaS dependencies, SOPS plus disciplined key custody is the fallback, at
the cost of the audit log. A middle step short of either move is hardware- or
KMS-backed key custody for the age key, which closes the
readable-by-the-shell gap without adopting a broker.

---

## Seventh-boundary appendix

*Attached to every ADR in the AI-toolchain series. It asks who is affected
upstream and downstream of the automation, not only how it behaves.*

- **(a) Upstream provenance.** The components are open source with public
  provenance (SOPS, age, systemd) or a commercial tool with a published
  security model (1Password). No opaque model sits in this control path; the
  encryption and injection steps are auditable by reading a 15-line shell
  wrapper and the vendor's documented client.

- **(b) Human-displacement assessment.** What this automates away is the
  riskiest clerical habit in small-team operations: hand-copying credentials
  into files and chat. No one's work is displaced; the person who used to do
  the pasting keeps every responsibility except the unsafe step. The
  de-skilling risk runs the other way - operators who never see a secret can
  forget how injection works - which is why the wrapper is short enough to
  read and the runbooks document the path end to end.

- **(c) Not delegated.** The secret system may *inject*; it may never *mint,
  widen, or share*. Creating a credential, raising its scope, or granting a
  person or agent access to a vault is a human action under review. The
  agent's machine identity is confined to a single dedicated vault: it can
  list and read what that vault holds - including the bootstrap token it
  carries in its own environment - so its compromise is bounded by the
  vault's scope, not by what was injected into a given session.
  Vault-per-machine scoping, not per-item handing, is the boundary; in-situ
  verification corrected this sentence from the stronger claim originally
  written here.
