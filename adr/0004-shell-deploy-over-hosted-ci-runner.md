# ADR 0004 - A guarded shell deploy over a hosted CI runner

**Status:** Accepted · in production (host-side execution; amended 2026-10-15 for the automatic trigger)

## Context

A single-server PHP application needs a way to go from "merged" to "live"
safely. The industry-default answer is a hosted CI/CD runner. For one app on
one server, that adds a moving part (runner availability, secrets shipped to a
third party, network round-trips) to solve a problem that is mostly local: get
the right commit onto this box without two deploys colliding or a
bad ref going out.

## Decision

A server-side deploy script executes on the box with explicit guardrails. The
original entry point was a manual invocation; the amendment below separates
that execution decision from the later automatic trigger:

- **Dirty-worktree rejection** - refuse to deploy over uncommitted local changes.
- **`flock`-based serialization** - only one deploy at a time; concurrent
  invocations fail fast instead of interleaving.
- **Ancestor-only ref enforcement** - the target must be reachable from the
  remote default branch, so a divergent side-branch ref is refused unless an
  operator explicitly overrides it. This permits an intentional rollback to
  an earlier commit on that branch.
- **Post-deploy healthcheck** - hit the app and confirm it's serving before
  calling the deploy done.
- **Rollback pointer** - record the previous SHA and expose a one-command
  rollback to it.
- **Structured deploy log** - every deploy/failure appends who, what, when.

## Consequences

- **The direct manual path has no hosted-runner dependency.** The automatic
  request path now does. Execution remains on the host in both cases.
- **Auditable and legible** - the guarded script keeps the host-side steps
  readable. The console's deployment history records the larger operation,
  including the checks and migrations around that script.
- **Costs:** I own the host-side guardrails. Tests and static analysis run in
  hosted CI; the automatic pipeline now verifies their results before acting,
  rather than leaving verification separate from deployment.

## Amendment - 2026-10-15

A push to the default branch now requests production deployment from GitHub
Actions. The hosted runner presents a short-lived OIDC assertion and holds no
deployment credential. The host verifies the request and the exact commit's
required checks under the production lock, then runs its own pipeline: assets,
migrations, the guarded shell script, and post-deploy verification.

The original reason for keeping execution on the host still holds. The desire
to ship reviewed merges without a separate deploy click changed the trigger,
so the original claim of no hosted-runner dependency no longer describes the
automatic path. Pull requests and engineering review still control code
promotion. [ADR 0058](0058-the-hosted-runner-asks-and-the-host-decides.md)
records the new request boundary.

## When I'd revisit

Multiple servers, blue/green or canary needs, or a team where many people
deploy - any of those tips the balance back toward a managed pipeline.
