# ADR 0020 - A private mesh for operator shells, public authenticated endpoints for browser consoles, over one VPN for everything

**Status:** Accepted · in production (SSH lockdown verified across the fleet as it stood on 2026-06-12; revenue-critical tier completed last)

## Context

A cyber-insurer's external port scan flagged a forgotten remote-desktop service
on the public internet on two servers - password-protected, but a brute-forceable
surface no one was using. Closing it was a one-line firewall change. The question
it forced was general: *how should every form of remote access to the fleet be
reachable?*

Two classes of remote access exist, with different users:

- **Operator shells (SSH).** Used by a one-to-two-person technical team and an
   automation host, all already centrally managed.
- **Browser admin consoles (HTTPS).** A status dashboard, a metrics stack, a web
   SQL tool, an internal LLM workbench, a few app back-offices. Used by the
   engineer *and* by non-engineer staff - a general manager, operations people -
   on devices nobody administers for them.

The tempting uniform answer: put a private mesh VPN (WireGuard, via Tailscale) in
front of everything and drop all public exposure. It's the textbook posture and
satisfies the insurer's "remote access behind a firewall and VPN" guidance. But
"everything" is where it breaks. A VPN in front of the browser consoles
reintroduces the failure mode that sank an earlier desktop tool
([0019](0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md)):
per-device client software non-technical users have to install, sign into, and
keep working. It also breaks what those consoles are valuable for - *click a URL
and you're in* - and drags TLS, certificate, and hostname assumptions through a
private resolver. The audience that most needs the consoles is the one least able
to maintain a VPN client.

The shells have the opposite shape: no per-device client cost the team isn't
already paying, and SSH is the highest-value brute-force target on the public
internet. Hiding it behind the mesh deletes that surface at near-zero friction.

So size the boundary to the audience, not uniformly.

## Decision

Split remote access by client type:

- **SSH onto the private mesh, public :22 dropped on enrolled hosts.** Hosts
  are enrolled in a tagged WireGuard mesh. Inbound SSH is restricted to the
  mesh range plus the automation host's address; the public internet is dropped.
  SSH is no longer reachable off the mesh on any locked host.

- **Browser consoles stay on the public internet, behind application
  authentication matched to their audience.** The dashboard that fronts
  other tools uses passkeys (WebAuthn), and compatible tools reuse that
  session. Authentication and permission checks protect browser access. No
  network boundary is added in front of those consoles.

Two design points make the lockdown safe to roll out live:

- **Fail-safe ordering.** The mesh/automation-host allow-rule is added *before*
  the blanket public allow is removed, so the connection running the change is
  never the one it cuts. On firewalld hosts a dead-man timer reloads the runtime
  ruleset minutes later, reverting a bad change unless it's been explicitly
  committed - you cannot lock yourself out by fat-fingering a rule.
- **Docker coexistence.** On container hosts the lockdown lives in its own `nft`
  `inet` table that is never flushed, so it composes with Docker's own ip-family
  rules and touches only host-destined :22 - container forward/DNAT paths are
  untouched.

Rollout is sequenced by blast radius: a canary host, then the low-risk fleet,
with the revenue-critical web and database tier locked **last**, after the
pattern is proven and every legitimate direct-SSH source to those hosts is in the
allow-set. The mesh stays a layer that can be slid *under* a browser console
later, per-app, for defense-in-depth - without redesigning the console.

## Consequences

**Positive.** The most-scanned public surface (SSH) is gone from the fleet at
near-zero friction, the exact control the cyber-insurer asks for. The browser
consoles stay frictionless for the non-technical staff who depend on them, with
the application gate doing the work the network would otherwise do. The
lockdown is reversible in one rule change per host.

**Accepted costs.** The browser consoles remain internet-reachable, so each one's
security rests on its authentication and permission checks without a network
pre-filter. The shared dashboard uses passkeys and a sign-in tripwire, but
application authentication remains a concentration of trust. There are now two
access models to reason about instead of one. And the split is a judgment call
about *audience*: it holds only while the consoles genuinely serve non-technical
users on unmanaged devices.

## Amendment - 2026-10-16

The fleet-wide SSH statement is a dated verification, not a rolling
certification: the source re-verified the fleet on 2026-06-12, and membership
has changed since. Each new or replacement host needs its own enrollment
and off-fleet reachability check.

The earlier claim that every browser console used MFA was too broad. The
passkey claim applies to the shared dashboard session; this record makes no
fleet-wide claim about an individual application's authentication factors.

## When I'd revisit

If a console's audience narrows to just the technical team, it should fold behind
the mesh too - the friction argument that kept it public no longer applies. If
the console count grows past a handful, the per-app authentication gates
should converge on one SSO/identity layer rather than a patchwork. If an
incident shows the application gate alone is insufficient, the mesh can sit
under those specific apps - the design keeps that move one firewall change
away so it does not require revisiting everything else.
