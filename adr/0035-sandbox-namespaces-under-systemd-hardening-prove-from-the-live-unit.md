# ADR 0035 - Let the hardened service create namespaces so the sandbox can confine the model, hold the boundary in AppArmor, and prove the sandbox from the live unit

**Status:** Accepted · in production (a subagent unit that runs model-selected commands inside Bubblewrap)

## Context

A subagent service runs a model's commands inside a Bubblewrap sandbox with
no network. Every delegation failed about nineteen seconds after acceptance:
the model's first file read died with `bwrap: No permissions to create new
namespace`. Ten in a row reached `failed` without a byte read. The boundary
held; nothing worked.

The kernel and AppArmor were not refusing. Unprivileged user namespaces were
restricted at the kernel setting, the reviewed `bwrap` profiles were
installed and enforcing, and a bare `bwrap --unshare-user` succeeded for the
service's user *from an attended shell*. No AppArmor denial was logged. The
refusal came from `RestrictNamespaces=true` on the systemd unit: under it,
Bubblewrap's single `clone()` with the full namespace flag mask returns
`EPERM` from systemd's seccomp filter. No narrower setting exists - Bubblewrap
asks for every namespace it wants in one call, and the filter matches the
whole mask, so restricting any single type denies the sandbox exactly as
`true` does. Each was measured individually.

A second refusal followed: with the sandbox's network disabled, Bubblewrap
unshares the network namespace and brings loopback up inside it, which opens
a `NETLINK_ROUTE` socket that `RestrictAddressFamilies` had not allowed.

Both sandbox proofs - the health contract and the trial harness - had been
run from an attended shell. They certified a Bubblewrap that starts for a
logged-in user and could never start for the service. Stage two went green
while every call failed.

## Decision

- **The unit sets `RestrictNamespaces=false` and allows `AF_NETLINK`.** The
  netlink family is Bubblewrap's isolation machinery, not reach; the model
  sandbox still has no network.
- **The namespace boundary moves to where it was always meant to sit.** The
  kernel restriction on unprivileged user namespaces stays on, Bubblewrap
  stays non-setuid, and the reviewed enforcing profiles confine what the
  namespaces the runner can now create are able to do - the child profile
  denies capabilities outright. Every other hardening property the unit
  carries was then measured *together, as the unit actually sets them*, and
  is compatible with reading and writing inside the sandbox.
- **Sandbox proofs run under the service's own restrictions, read from the
  live unit**, never from an attended shell. A future restriction that breaks
  the sandbox now fails the health contract and the trial instead of the
  delegation.
- **The fix reaches the host only through the attended deployment-authority
  upgrade** ([ADR 0030](0030-immutable-releases-atomic-promotion-append-only-journal.md)).
  Copying the unit by hand is not the remedy; neither is disabling the kernel
  restriction or a setuid Bubblewrap.

## Alternatives considered

- **Keep the unit's seccomp restriction and start each model run as its own
  pinned unit through a narrow polkit rule.** Preserves more of the runner's
  own confinement, at the cost of a unit, a polkit grant, and the model's
  standard streams crossing a unit boundary. A larger boundary change than the
  fault requires; not ruled out for later.
- **Loosen the kernel setting.** Would fix the symptom by removing the layer
  that makes the profiles meaningful.

## Consequences

- **The runner process can now create namespaces itself, not only through
  Bubblewrap.** That authority is bounded by the same AppArmor profiles and by
  the unit's remaining hardening: no capabilities, no new privileges, a strict
  read-only system with a named writable set, and an inaccessible application
  database, broker socket, container socket, and production directory.
- **"It works in a shell" is not evidence about a hardened unit.** Every
  layered-confinement stack - systemd, seccomp, AppArmor, kernel sysctls, the
  sandbox itself - has to be proved from inside the innermost layer that will
  actually run it.
- **A related finding from the same host:** a vendor sandbox re-opens each
  read-deny path after entering Bubblewrap to confirm the mask took effect,
  and reads a root-owned `Permission denied` as an *unenforced* deny list. So
  the credential-custody boundary cannot be held by that sandbox at all; it is
  held by the executor identity's own permissions and the systemd unit, and the
  sandbox holds workspace confinement. Stated rather than papered over
  ([ADR 0027](0027-pin-and-prove-unsigned-dependencies-keyed-to-the-pin.md)).

## When I'd revisit

If the sandbox tool gains a way to request namespaces in separate calls, or
systemd gains a per-type allow that matches Bubblewrap's mask, the unit's
restriction comes back. If a second model runner lands on the host, the
per-run pinned-unit alternative gets weighed again with two consumers instead
of one.
