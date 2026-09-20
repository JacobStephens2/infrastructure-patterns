# ADR 0043 - Audit history never retains secret values, and existing history is migrated to match

**Status:** Accepted · in production (the user-history audit trail of the operations platform staff work in daily)

## Context

The platform keeps a history of changes to user records: who changed what,
when, the previous values, the new values, and a restorable snapshot. That is
the right design for almost every field, and the wrong one for a field that
holds a credential. A history table that faithfully records old and new values
is, for those fields, a second credential store: one with a longer retention
than the credential itself, and a wider audience, since people who may read an
audit trail are not the people who may read a secret.

The forward fix is easy. The hard question is the history that already exists.
Redacting it destroys the original values for good, and an audit trail is the
one place where destroying data feels like the wrong instinct.

## Decision

An audit trail is not a credential store. History keeps *that* a secret-bearing
field changed, *who* changed it, and *when*. It never keeps the value.

- **Diffs keep the field name and replace the value** with a fixed redaction
  marker, in both the previous-values and new-values payloads. The fact of the
  change stays auditable.
- **Restorable snapshots omit the field entirely.** A snapshot is something the
  system can write back. A redaction marker in a snapshot is a restore that
  sets someone's credential to the marker.
- **Both transformations recurse.** A caller cannot bypass the policy by
  nesting a secret-bearing field inside another payload.
- **One policy class decides what counts as secret-bearing**, by normalized
  field name: the credential-word stems, with plural and
  serialized-or-encrypted suffixes. It carries one explicit exclusion, a
  boolean "must change password" flag that matches the pattern and holds no
  secret.
- **Existing history is migrated to the same policy**, knowing that makes the
  original values unrecoverable. The migration is pure data manipulation, runs
  in one transaction, writes its row to the migrations ledger, and is a no-op
  on a second run.

## Consequences

- A leaked or over-shared history export no longer contains credentials, and
  neither does a database backup of that table taken after the migration.
- **Recoverability of those values is deliberately destroyed.** If a credential
  is lost, it is rotated, not restored from the audit trail. That was always
  the right answer; now it is the only one.
- **Matching by name is a heuristic with both failure directions.** A secret in
  a field with an innocuous name is missed, and a harmless field with a
  credential-shaped name loses its history. The matcher was adjusted twice on
  the day it shipped, once to tighten it and once to widen it. Centralizing it in one class is
  what makes the next correction a one-line change that applies everywhere.
- Backups taken before the migration still hold the old values until they age
  out. The migration fixes the table, not the past.

## When I'd revisit

If secret-bearing fields become numerous or oddly named, name matching gives
way to an explicit registry declared beside the schema, so a new secret field
fails closed until someone classifies it. If a regulator or an investigation
ever needs proof of *which* value was set, the answer is a salted digest of the
value in history - comparable, not reversible - and still never the value.
