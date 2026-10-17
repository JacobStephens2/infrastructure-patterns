# ADR 0062 - Tests refuse the production schema by name, and a wiring check enforces the guard

**Status:** Accepted · in production (the reservations platform's integration-test guard and fixture-cleanup migration; guard recognition and wiring verified)

## Context

The test suite trusted an environment flag that did not identify its database.
A host described itself as a development server while its application settings
pointed at production. Four full-suite runs on 2026-09-30 wrote fixtures into
production, re-ran migrations outside the migration logger, and ran a send job.
Some tests had no guard. Others loaded the application's common bootstrap,
which opens a database connection, before checking their guard.

The environment flag was not lying about the property it actually represented.
It simply was not proof that a database was disposable. Fixing that flag on
one machine would leave the next machine free to combine development behavior
with a production connection.

Cleanup was a separate obligation. The audit enumerated fixture artifacts,
checked that nothing else referenced them, and wrote a narrowly matched
migration to remove them. A recorded message marked sent was not evidence
that mail had left the system: those fixture sends had been refused before
transport. The guard had to prevent another run; it could not undo prior ones.

## Decision

**Integration tests refuse the production schema before application bootstrap,
and a unit test checks that the refusal is wired first.** The signal is the
schema the application settings name, independent of the environment flag.

- **Read only enough configuration to identify the target.** The guard reads
  the configured database name without loading the common application
  bootstrap or opening its connection. It normalizes case and surrounding
  whitespace, then skips the test if the name identifies production.
- **Make the guard the first setup statement.** A refusal after a connection,
  migration, or fixture write is too late. The order is part of the control,
  rather than a convention left for each test author to remember.
- **Check the callers, not only the helper.** A unit test walks integration
  tests and recognizes database use through application constants, common
  bootstrap, support runners, subprocesses, and application HTTP calls. Each
  recognized test must import the guard and call it first. A newly added test
  in that set fails the wiring check before its database test runs.
- **Keep exceptions in the check.** One test uses its own scratch connection
  and refuses any target outside that scratch naming rule. Its exemption is
  explicit in the wiring test, not an inline bypass a test can grant itself.
- **Remove old artifacts with a reviewed migration.** Fixture markers narrow
  every deletion. Where fixed identifiers are used, the fixture marker is
  checked too. Cleanup belongs to the normal migration path and its record,
  not to another unlogged test run.

The wiring cases failed before the calls were installed and passed afterwards.
The integration suite was deliberately not run on the production-connected
host to prove that it should not run there. Recognition and source wiring are
verified; that is a different claim from executing the changed tests safely
against a sandbox.

## Consequences

- **The environment flag no longer authorizes fixture writes.** A development
  host that connects to the known production schema is refused, while a
  disposable target remains usable by tests that need to write.
- **This is a deliberate name blocklist.**
  [ADR 0034](0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md)
  uses an allowlist because every new webroot file must be private by default.
  Here, enrolling every new scratch schema would make routine work depend on
  editing the guard and encourage bypasses. The allowlist moved to the wiring
  check: the known database-reaching tests must carry the guard, with named
  exceptions for a different enforced boundary.
- **The target list still has a cost.** A production rename or a second
  production schema needs an explicit update; this rule cannot recognize a
  target it has never been told is production. The wiring check does not
  remove that maintenance obligation.
- **Source inspection has a boundary too.** The check recognizes particular
  ways tests reach the application database. A new connection mechanism must
  join that recognition, rather than be assumed covered because the suite is
  green. A read-only test account would not exercise tests that create fixtures
  by design; harmless tests would not exercise their contract.
- **Cleanup is irreversible.** The audit and narrow predicates are what make
  deleting production artifacts defensible. A passing prevention check says
  nothing about whether those old rows have been removed.

## When I'd revisit

If production identities multiply, I would replace the single-name rule with
a maintained target identity policy before adding another target. If tests
gain more indirect database entrypoints, the guard belongs below those paths
rather than behind an ever-growing source recognizer. Neither change removes
the need to assert that the refusal happens before the first side effect.
