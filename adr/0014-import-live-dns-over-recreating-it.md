# ADR 0014 - Import live DNS into Terraform over recreating it from a desired-state list

**Status:** Accepted · in production

## Context

A fleet of ~220 DNS records across 9 zones (A, CNAME, MX, TXT, SRV) had just been
consolidated onto one provider and was serving live traffic - web, and the email
records that matter more: MX, SPF, DKIM selectors, DMARC. The goal was to bring all
of it under Terraform so every later change is a reviewable diff.

Two ways to put existing infrastructure under code. **Recreate:** author a
desired-state list and let Terraform create it, deleting whatever doesn't match.
**Import:** pull the records that already exist into Terraform state and write
configuration that matches them, changing nothing.

Recreate is tempting because the config is hand-authored and clean from the start,
but against live records it is the wrong default. Terraform's create path would try
to make records that already exist (duplicates or API errors), and any record the
hand-authored list forgot - an obscure DKIM selector, a verification TXT - would be
*deleted* as drift. For DNS that is an outage and a silently broken mail domain, in
exchange for tidier source files.

## Decision

Import the live records; never recreate them.

- **Enumerate every record from the provider API and emit one import block per
  record** (a small, re-runnable generator script). Let Terraform generate the
  matching resource configuration (`plan -generate-config-out`), so the config is
  derived from reality rather than guessed.
- **Drive to a zero-change plan.** Done correctly, `terraform plan` reports *N to
  import, 0 to add, 0 to change, 0 to destroy*. That zero proves the code matches
  what is actually serving traffic.
- **Treat the live provider as the source of truth during onboarding**, the
  generator script as the reconciler, and a clean plan as the acceptance test. The
  hand-authored desired-state list comes *after* parity, for new records only.
- **Guard the create path off until parity exists.** A feature flag defaulting to
  "manage nothing" keeps an accidental apply from duplicating records that are
  already live.

## Consequences

- **Zero downtime and no drift window.** Nothing is deleted or recreated; the
  records that serve traffic are the records Terraform adopts. That is the whole
  point, and it is worth the messier mechanics.
- **A no-op plan becomes the trustworthy baseline.** Once plan is empty, any future
  non-empty plan is a real, intended change - the diff means something.
- **Generated config is verbose and machine-named.** Importing 200+ records yields
  200+ resource blocks with generated identifiers, not hand-curated names.
  Acceptable: it is honest, and renaming in state is a separate, optional cleanup.
- **Provider quirks surface at import, not later.** The generator emitted both
  `content` and a structured `data` block for SRV records, which the provider
  rejects as mutually exclusive; the fix was a deterministic post-process. Import
  forces these up immediately instead of on a future edit.
- **The record list stops being authored and starts being derived.** Re-running the
  generator doubles as a drift audit: anything it surfaces that the config lacks was
  changed outside Terraform. That inverts the usual "config is truth" stance to
  "live is truth, config must match it" - correct for adopting existing systems.

## When I'd revisit

For a **greenfield zone** with no live records, recreate is right: author the
desired state directly and let Terraform build it, no import dance. The same holds
if a record set is small enough to recreate inside a planned maintenance window
where a brief inconsistency is acceptable. The import-first rule is specifically for
adopting infrastructure already serving traffic - most of the interesting cases, and
the one where recreating quietly breaks things.
