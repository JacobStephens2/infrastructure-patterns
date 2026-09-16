# ADR 0028 - One secret manifest per consumer, generated from a tracked declaration; and validate every manifest the machine reads, not every manifest a harness launches from

**Status:** Accepted · in production (extends [ADR 0018](0018-runtime-injected-secrets-over-plaintext-config.md) after a six-hour outage)

## Context

ADR 0018's broker design resolves a manifest of vault references into a
process's environment at start. On the orchestration host, every unattended
consumer - twenty-odd systemd units, a status dashboard, a deploy verifier,
six agent harness profiles - resolved the **same 252-reference manifest**,
though none read more than a fraction of it. Resolution is all-or-nothing.

One vault item was deleted at nine in the morning. Every non-interactive
consumer of that manifest failed closed at once: four dead units and
thirty-nine failed runs, until a human noticed at three in the afternoon
through an unrelated error. None of the four units had any use for the deleted
item.

The documented remedy - "after a change in the vault, run the validator; it
names the variables that broke" - was run and printed six green lines. The
validator walked the harness profiles and checked the manifest each one
*launches from*. The manifest the systemd units read was launched from by
nothing, so nothing named it, so it was never checked. That is the worst
shape a check can have: the documented gate for exactly this fault, cheap, and
telling the operator everything is fine.

## Decision

- **One manifest per consumer, generated from a per-consumer declaration
  tracked in the repository.** Shared fragments (the mail block, the SMS
  block) are declared once and composed; the rendered copies under `/etc` are
  converged by configuration management. The blast radius of a vault change
  becomes one consumer, not the box.
- **Every assignment inside a manifest is a vault reference, with no
  exceptions.** A value no vault holds (a published phone number, a public
  hostname) is a *constant*, lives in a separate constants file delivered
  beside the manifest, and is global - a file with no references has no blast
  radius to bound. This replaced a hand-maintained "not really a secret"
  allowlist, which review found carrying four names with no reader anywhere.
- **The declaration also generates a startup assertion.** Narrowing introduces
  a fail-open risk that did not exist before: a variable a consumer needs was
  always present; afterwards a read added without its declaration line is
  simply unset at runtime. Without the assertion the change trades a six-hour
  loud failure for a permanent quiet one.
- **Some consumers keep a wide manifest, on purpose**, where the read set
  cannot be determined without running the program (a launcher for another
  program, a consumer that shells out to remote scripts, an operator-supplied
  command). The reason is recorded in the declaration; a future reader finds
  a decision, not an oversight.
- **The validated set is "every manifest this machine reads."** The launcher's
  machine config lists extra manifests - with their backend, since a second
  manifest need not share the first's - and each is a first-class member of
  the validated set while remaining deliberately inert everywhere else: it
  does not appear in the launch pickers, and nothing launches from it.
- **Every validator line names its manifest, pass or fail.** Six harnesses over
  one file used to print six names and no files, so "green" could not be read
  as coverage - which is the operator's actual question after a vault change.
- **Fail closed on an entry that cannot be checked.** A missing file, an
  unparseable line, an unknown backend: an error, never a skip. An operator who
  recorded a file believes it is being checked.
- **Configuration management refuses to converge a manifest whose tracked
  source is dirty.** The source of truth moved from a root-owned file to a
  group-writable working tree; the real control is that the main branch
  requires a reviewed, signed commit, and that only binds what was committed.

## Consequences

- **A vault rename now kills the consumers that read the renamed item, and
  only those.** A reference a consumer carries but never reads still fails its
  manifest closed, so "carries but never reads" is blast radius, not
  convenience - which is why the shared fragment was split a second time, so a
  renamed SMS credential could not stop units that cannot send an SMS.
- **A rebuild can reproduce the manifests from git.** Before, the 252
  references existed only as a root-owned file on the box being rebuilt, and
  the rebuild guide named that file once, as a step verifying it resolves.
- **The offline validator covers the same set** for the faults it can see
  without a vault. It is a weaker check, not a narrower one.
- **Still uncovered:** references outside any manifest - a script calling the
  vault CLI directly. The same host had a renamed item break four such scripts
  for thirteen days. That is a repository-scanning problem, not a launcher one,
  and it is named here so it does not pass for solved.

## When I'd revisit

If the broker ever resolves references lazily, per read, the whole-or-nothing
premise goes and per-consumer manifests become optimization rather than
isolation - keep the declaration for the assertion and the rebuild, drop the
narrowing argument. If the number of consumers passes what one declaration
file can hold legibly, split by unit, never by "family."
