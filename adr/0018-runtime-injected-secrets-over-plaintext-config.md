# ADR 0018 - Runtime-injected secrets over plaintext config, with the store matched to the team

**Status:** Accepted · in production on two fleets

## Context

A credential's default resting place is a plaintext file: a `.env` next to the
app, a token in a config, a connection string in a shell script. Every copy
leaks - through disk images, backups, a stray `cat`, a repo that was supposed to
stay private. And the file is half the problem: a secret sitting in a process's
config for its lifetime is readable by anything that can read that process's
directory, used or not.

I operate two production fleets. One is team-operated: a small business's
platform where several people and an autonomous coding agent need credentials,
people join and leave, and a revoked key has to actually die. The other is
solo-operated: my own server fleet, one operator, no seat budget, recovery that
works offline with no vendor in the loop. One secret-management answer does not
fit both - but one *invariant* does.

## Decision

**Secrets are injected into the process environment at runtime from an
encrypted store, never read from plaintext at rest - and the store is chosen
per operational context.** The consumer contract is environment variables; no
consumer knows which backend produced them.

- **Team fleet: a managed broker (1Password).** Credentials live in the vault;
  `op inject` resolves a checked-in template of `op://` references (references in
  git, values never) into the process's environment for its lifetime,
  re-injecting at restart. One template feeds both consumer shapes on the box: a
  systemd service renders it in `ExecStartPre` to a tmpfs runtime file
  (re-resolved every unit start, wiped on reboot), and the interactive agent
  launcher exports it env-only at session launch. The template doubles as the
  reviewable inventory of everything the machine identity can receive. The broker
  earns its subscription where a team exists: sharing without chat-pasting,
  central revocation on offboarding, rotation in one place (each consumer picks
  it up at its next launch), and an access log. The agent is injected the same
  vault way and the path writes nothing to its sandbox, but injected values are
  inherited by every child process and transcripts persist to disk, so the
  never-print discipline is part of the control, not a property of the mechanism.
- **Solo fleet: file-based encryption (SOPS + age).** Each secret file is
  encrypted to an age key (`*.env.sops`); a ~15-line `secret-env` wrapper
  decrypts one file into one command's environment and `exec`s it, and systemd
  units call the same wrapper. Free, offline, no third party at decrypt time,
  ciphertext safe in backups. The one irreplaceable artifact is the age private
  key, backed up out-of-band; every secret behind it is re-mintable from the
  issuing service, so a lost key is an annoyance, not a catastrophe.
- **The seam is the point.** Consumers see only environment variables, so the
  backend swaps behind the wrapper. The solo fleet proved it: years on mode-600
  plaintext `.env` files sourced per-command, then the SOPS upgrade touched one
  wrapper and two systemd units - zero consumers. The same seam is the migration
  path to a broker if the context changes.
- **Scoping survives the abstraction - and its real unit is the vault.** Broker
  side, the machine identity is a dedicated service account confined to a single
  vault, separate from human seats; injection granularity differs per consumer
  (per-unit-start for the service, per-session - days - for the agent). File
  side, each `.env.sops` holds one service's credentials, tokens are minted
  least-privilege (read-only and edit tokens in separate files), and the runbooks
  write new tokens straight into ciphertext - no plaintext step to forget.

## Consequences

- **A leaked disk, backup, or transcript exposes ciphertext, not credentials.**
  The accident the plaintext default invites - the stray `cat`, the file in the
  wrong tarball - now discloses nothing. The discipline is only as good as its
  coverage: an adopted invariant is worth auditing for plaintext that predates it
  and never got migrated.
- **Two backends is more honest than one, and costs a second mental model.** The
  broker's audit log and revocation have no SOPS equivalent; SOPS's offline,
  zero-vendor recovery has no broker equivalent. One tool for both fleets would
  trade a real property away on one of them.
- **Neither defeats a compromised operator account.** On the solo fleet the age
  key is readable by the operating user, so an attacker with that shell can
  decrypt; the broker still needs a bootstrap credential on the box for
  non-interactive use, and if that credential is injected into an agent's
  environment the agent becomes a broker *client*, not a downstream consumer.
  Both choices *concentrate and harden* the root of trust - they do not eliminate
  it. Naming that is part of the decision.
- **The broker is a runtime dependency; the files are not.** A broker outage or
  expired seat blocks injection on the team fleet, and the launcher is
  deliberately fail-closed: it refuses to start a consumer with an empty
  environment rather than degrade, so an outage gates new launches and restarts
  while running consumers coast on their injected environment. The solo fleet
  decrypts with no network at all. Each fleet got the failure mode it can afford.
- **Rotation asymmetry.** Broker rotation is one update, consumers pick it up on
  next injection. SOPS rotation means re-encrypting files and, for the age key
  itself, re-keying every file - acceptable at solo scale, painful beyond it.

## When I'd revisit

The selection criterion is the team, so the trigger is the team changing. A
second regular operator on the solo fleet - or an agent whose secret access
needs per-read audit - tips it to a broker, and the `secret-env` seam makes that
a wrapper swap, not a migration. If the team fleet had to shed its SaaS
dependencies, SOPS plus disciplined key custody is the fallback, at the cost of
the audit log. A middle step short of either is hardware- or KMS-backed custody
for the age key, closing the readable-by-the-shell gap without adopting a broker.

---

## Seventh-boundary appendix

*Attached to every ADR in the AI-toolchain series. It asks who is affected
upstream and downstream of the automation, not only how it behaves.*

- **(a) Upstream provenance.** The components are open source with public
  provenance (SOPS, age, systemd) or a commercial tool with a published
  security model (1Password). No opaque model sits in this control path; the
  encryption and injection steps are auditable by reading a 15-line shell
  wrapper and the vendor's documented client.

- **(b) Human-displacement assessment.** This automates away the riskiest
  clerical habit in small-team operations: hand-copying credentials into files
  and chat. No one's work is displaced; the person who used to paste keeps every
  responsibility except the unsafe step. The de-skilling risk runs the other way
  - operators who never see a secret can forget how injection works - which is
  why the wrapper is short enough to read and the runbooks document the path.

- **(c) Not delegated.** The secret system may *inject*; it may never *mint,
  widen, or share*. Creating a credential, raising its scope, or granting a
  person or agent vault access is a human action under review. And a caution this
  pattern forces into the open: when an agent's machine identity is a broker token
  scoped to a vault, the agent can list and read everything in that vault -
  including the bootstrap token in its own environment - not only the values
  injected for a task. So the boundary that bounds an agent compromise is the
  vault's scope: one dedicated vault per machine identity, holding only what that
  identity may ever receive. Per-item injection is not a containment boundary;
  scope the vault as if the agent will read all of it, because it can.
