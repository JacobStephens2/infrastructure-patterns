# ADR 0031 - A CI deploy key that reaches a shared host, restricted to one installed forced command, over having the host pull

**Status:** Accepted · in production (a shared-host fleet deployer; generalized from one dashboard)

## Context

Pushing to main should deploy a small service over SSH from the hosted CI
workflow that just ran its tests. The surprising part is where it deploys to:
a host that also serves dozens of other sites, including client work. A CI
secret that can open a shell on that host is a shell on every site it serves.

The obvious alternative keeps every CI credential off the machine: the host
pulls, by timer, webhook listener, or a oneshot unit that fetches main and
runs the deployer locally.

## Decision

- **The key is allowed to reach the host because it cannot open a shell.** Its
  `authorized_keys` entry forces one command - the deployer that the installer
  placed outside the checkout, *not* the file of the same name inside the
  deployed checkout - and that command takes a revision and nothing else. It
  moves the copy, restarts the service, and reinstalls dependencies when they
  changed. It does not install unit files or the virtual host, does not reload
  the web server, does not merge, rebase, or discard, and does not open a
  shell.
- **The forced command is outside the deployed tree on purpose.** Merging a
  pull request can change what the service is; it cannot change what the key
  is allowed to run. If the forced command were a path inside the checkout,
  the next merge could rewrite it into a shell and the restriction would be a
  name rather than a fact.
- **The host key is pinned in the workflow.** The job does not accept a host
  key on first use; a different machine answering at that name is a failure,
  not a deploy.
- **Until the installer places the key, the job is skipped** and a green run is
  the test suite, not a deploy.

## Alternatives considered

- **Host pulls on a timer.** No CI credential on the host, at the cost of a
  polling interval between merge and deploy - and the point was to see the
  change within a minute, while it is still in mind.
- **Host runs a webhook listener.** Another always-on service on a host that is
  not trying to become a platform, plus a shared secret to rotate.
- **Pushing from the workflow that already ran the tests** is one step, uses
  the gate that already exists, and fails in the same place the merge
  happened. The cost is this key, paid for with the forced command, the
  installed copy, and the pinned host key.

## Consequences

- **A merge to main is a deploy**, once the key is installed.
- **The restriction is only as strong as the installed command.** Re-running
  the installer is how the command and the key are replaced; merging is not.
- **Private by credential, not by network reach** applies to the service too:
  its hostname is public in certificate-transparency logs from issuance, the
  application's own sign-in is the entire protection, and its session cookie
  is `__Host-`-prefixed so it *cannot* be widened to the parent domain - which
  would hand a session to every other hostname on the box to spare one
  password prompt. Keeping the service off public DNS entirely (mesh or SSH
  tunnel, [ADR 0020](0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md))
  was not weighed, and is recorded as open rather than rejected.

## Amendment - 2026-10-16

The single-dashboard shape became a registry-driven deployer for the shared
host's fleet. Each site has its own restricted key, fixed to that site's entry;
the registry declares its branch, checkout, after-deploy commands, and health
check. The installed program serializes deployments, refuses a dirty checkout
or the wrong branch, and requires a fast-forward. A written exceptions list
keeps release-directory applications, image deployments, and other incompatible
shapes on their own deployers.

This avoids copying the guardrails into one script per site. It also gives one
program a wider blast radius: a deployer bug can affect every registered site,
and a new registry entry is a trust decision that needs review. The registry
and restricted-key installer are present in the source; this review did not
re-prove every site's live key or deployment.

## When I'd revisit

The second-service condition arrived and led to the registry above. If the
key's cost ever outweighs time-to-deploy, or an audit rejects CI-held SSH keys,
the pull-based alternative is the door to reopen. If the service ever holds
anything whose leak is harm rather than embarrassment, the network-reach option
moves from
"unexamined" to "examine first."
