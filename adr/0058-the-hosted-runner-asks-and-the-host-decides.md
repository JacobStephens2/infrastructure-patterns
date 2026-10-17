# ADR 0058 - The hosted runner asks and the host decides

**Status:** Accepted · in production (automatic requests for the reservations platform, live since 2026-10-15)

## Context

A hosted runner can announce a reviewed release without holding the credentials
that execute it. I wanted a push to the default branch to ship after its checks,
rather than require a separate deploy click. The guarded host script from
[ADR 0004](0004-shell-deploy-over-hosted-ci-runner.md) already did the final code
deploy, but calling that script alone was not the whole production operation.
Assets, migrations, the independently checked production marker, and durable
deployment history belonged to the host's pipeline too.

The conventional answer was an SSH deploy key in GitHub Actions. A draft took
that shape and was removed rather than shipped. It would have given a hosted
job production authority while bypassing parts of the operation the host
already knew how to perform. A shared webhook secret would move the trigger
without removing the credential to store and rotate.

The useful division was between proving who asked and deciding whether the
requested commit may deploy. Pull requests and engineering review still control
code promotion. Automation removes the later deployment click; it does not
replace that review with the runner's assertion that a change is good.

## Decision

The Actions workflow requests and observes. The operations console verifies,
selects, deploys, and records. The job receives no production SSH key, database
credential, or deployment App private key.

- **Use a short-lived OIDC identity.** The job asks GitHub for a signed token
  intended for this console. The console verifies the signature against
  GitHub's published keys, the issuer, the audience, expiry, and a maximum age
  of 15 minutes. An authentic token is not sufficient merely because GitHub
  issued it.
- **Pin the allowed provenance.** Verify the repository and owner by immutable
  numeric identities as well as the expected repository, one workflow on one
  branch, a push event, and a GitHub-hosted runner. Refuse a reusable workflow
  invoked through another path. A matching display name alone is not the
  authority boundary.
- **Take the target from the signed token.** The requested commit is the one
  whose push started this run. It is not the branch's tip when the console
  happens to receive the request. A request body naming another commit is
  refused, rather than turning a valid identity into authority over any ref.
- **Read the checks on the host.** The workflow may wait for CI to finish, but
  that is an optimization. Under the production lock, the host independently
  reads the required check results for that exact commit's default-branch push
  runs. Caller-supplied success is not evidence.
- **Keep deployment authority on the host.** A dedicated GitHub App is installed
  on the product repository alone. Its private key stays on the host, which
  mints short-lived installation tokens. Incomplete configuration, the wrong
  installation, missing permissions, or an incompatible marker protection
  blocks preflight instead of falling back to a human token.
- **Observe an operation the runner does not own.** The console records the
  request and its run attempt. The worker executes the host pipeline and owns
  its outcome. Cancelling the job or losing its progress connection cannot
  cancel the deployment or manufacture a successful result.

## Consequences

- **The dependency avoided by ADR 0004 has returned for the automatic path.**
  Hosted workflow availability and OIDC verification now matter to requesting
  a release. The guarded host execution remains, and direct manual operation
  remains available, but the automatic release path is no longer independent
  of the hosted service.
- **The observer's result needs interpretation.** If observation times out, the
  operation can still finish on the host. The console's durable record is the
  source of truth; a workflow that lost contact cannot declare success. When
  a newer eligible commit carries the requested one, the workflow follows the
  operation that actually ships it.
- **The merge mechanism is part of the trigger.** GitHub suppresses downstream
  workflows for pushes made with an Actions `GITHUB_TOKEN`. A merge path using
  that token could silently request nothing. Before cutover, the written audit
  checked the 200 most recent merged pull requests and found every merge came
  from a person's account. Future merge automation must preserve a trigger
  identity that starts the workflow; a green merge alone is not proof of that.
- **This differs from constraining a credential.**
  [ADR 0031](0031-ci-deploy-key-restricted-to-one-forced-command-over-host-pull.md)
  lets CI hold a key and restricts its installed command. Here the host accepts
  a narrow signed request and retains the deployment credentials and checks.
  The cost is a verifier, a durable operation, and an observer that must report
  somebody else's result accurately.

## When I'd revisit

Revisit before changing the workflow path, repository ownership, merge identity,
or runner type: each is part of the verified request, not incidental plumbing.
If hosted-service availability becomes the release bottleneck, reconsider the
trigger without moving the host's credentials into it. A different trigger
should enter the same guarded pipeline and produce the same durable evidence.
