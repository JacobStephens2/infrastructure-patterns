# ADR 0004 - A guarded shell deploy over a hosted CI runner

**Status:** Accepted · in production

## Context

A single-server PHP application needs a way to go from "merged" to "live"
safely. The industry-default answer is a hosted CI/CD runner. For one app on
one server, that adds a moving part (runner availability, secrets shipped to a
third party, network round-trips) to solve a problem that is mostly local: get
the right commit onto this box, atomically, without two deploys colliding or a
bad ref going out.

## Decision

A server-side deploy script, invoked on the box, with explicit guardrails:

- **Dirty-worktree rejection** - refuse to deploy over uncommitted local changes.
- **`flock`-based serialization** - only one deploy at a time; concurrent
  invocations fail fast instead of interleaving.
- **Ancestor-only ref enforcement** - the target must be a fast-forward of the
  deployed branch, so you can't accidentally ship a divergent or rewound ref
  (with an explicit override for the rare intentional case).
- **Post-deploy healthcheck** - hit the app and confirm it's serving before
  calling the deploy done.
- **Rollback pointer** - record the previous SHA and expose a one-command
  rollback to it.
- **Structured deploy log** - every deploy/failure appends who, what, when.

## Consequences

- **No external dependency** in the release path; nothing breaks because a
  hosted runner is down or a token rotated.
- **Auditable and legible** - the whole pipeline is a few hundred lines of shell
  you can read in one sitting, and the log is the source of truth.
- **Costs:** you forgo the ecosystem (matrix builds, parallelism, marketplace
  actions) and have to write the guardrails yourself. Tests/static analysis run
  separately in hosted CI on push - deploy and verify are deliberately split.

## When I'd revisit

Multiple servers, blue/green or canary needs, or a team where many people
deploy - any of those tips the balance back toward a managed pipeline.
