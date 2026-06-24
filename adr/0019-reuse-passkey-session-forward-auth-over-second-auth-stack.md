# ADR 0019 - Reuse an existing passkey session to gate a second app (Caddy forward_auth) over standing up a second auth stack

**Status:** Accepted · in production

## Context

A non-engineer who knows SQL needed a visual, Workbench-like way into a
production MySQL database after a server upgrade cut off the desktop path. The
binding requirement was *zero client-side software to maintain*: desktop MySQL
Workbench had failed twice, not on capability but on the user's machines keeping
it installed and configured.

Two facts shaped everything:

1. **A good auth stack already existed.** An internal status dashboard (Flask)
   had just been hardened to passkey sign-in (WebAuthn, credentials in a password
   manager) behind a magic-link email allowlist, with CSRF protection, rate
   limits, a 24-hour absolute session cap, and a sign-in tripwire. Its session
   cookie is scoped to the parent domain (`Domain=.example.com`). A second login
   for the SQL tool would mean a second credential to phish and a second stack to
   patch - net-negative for a two-person user base.
2. **The database is firewalled per source IP.** The orchestration host that
   would run the tool is already allowlisted; the user's residential IP is not,
   and chasing a residential address's churn in a firewall is a non-starter.

A network boundary (Tailscale / WireGuard) was declined on purpose: it would hide
the tool but reintroduce the per-device client maintenance that made the desktop
app fail. Passkeys are phishing-resistant and the session gate was judged
sufficient; a VPN can be layered on later without changing this design. A bespoke
web SQL client was rejected outright - it is a commodity security product whose
every feature brokers raw SQL against production.

## Decision

Run a stock web SQL client (CloudBeaver CE, the web edition of DBeaver) in Docker
on the orchestration host, and gate it with **Caddy `forward_auth` delegated to
the existing dashboard session** - one auth stack reused across a second app, no
OIDC/SSO infrastructure added.

```
browser -> db-admin.example.com   (A record -> orchestration host)
        -> Caddy :443 (Let's Encrypt TLS)
             forward_auth -> dashboard.example.com/api/auth-check
             (forwards the shared session cookie; 401 -> redirect to sign-in)
        -> web SQL client, 127.0.0.1:8978   (X-User = the verified identity)
        -> production MySQL, from the host's already-allowlisted IP
```

The dashboard exposes one endpoint, `/api/auth-check`, returning `200` plus an
identity header for a valid signed session cookie and `401` otherwise. The Caddy
site block does the rest:

```caddyfile
db-admin.example.com {
    reverse_proxy 127.0.0.1:8978

    forward_auth https://dashboard.example.com {
        uri /api/auth-check
        # Strip WS-upgrade headers from the auth subrequest only; the proxied
        # app speaks WebSocket and keeps its own Upgrade headers.
        header_up -Upgrade
        header_up -Connection
        # The verified identity becomes the upstream's login header. copy_headers
        # has SET semantics, so any client-forged X-User is overwritten on the
        # only path that reaches the upstream.
        copy_headers X-Forwarded-Email>X-User
        @unauth status 401
        handle_response @unauth {
            redir https://dashboard.example.com/email?next=https://db-admin.example.com{uri} 302
        }
    }

    # Caddy runs request_header AFTER the authenticate stage, so these strip
    # client-supplied identity headers without clobbering the X-User that
    # forward_auth just set.
    request_header -X-Team
    request_header -X-Role
}
```

The web client's `reverseProxy` auth provider trusts `X-User` and auto-provisions
on first visit. An operator clicks "Database" in the dashboard and lands in a SQL
workbench already signed in as their dashboard identity - no second login, no
shared state beyond the one cookie.

Three details make this correct, not merely convenient:

- **Header forgery is structurally dead.** Unauthenticated requests never reach
  the upstream (401 -> redirect); authenticated requests have `X-User` overwritten
  from the auth response; residual identity headers are stripped *after* the
  authenticate stage. Caddy's directive ordering (`forward_auth` before
  `request_header`) is what makes both operations compose - get the order wrong
  and you either clobber the real identity or leave a forgeable one.
- **The cookie scope was already paid for.** The parent-domain cookie predates
  this project (it gates other internal tools the same way), so the subdomain sees
  it with no new handoff protocol. The WebAuthn RP ID stays bound to the
  dashboard's host - the passkey ceremony only happens there; satellite apps
  consume the resulting session.
- **Defense stays layered behind the gate.** The container binds to loopback only,
  database accounts are pinned to the host's IP, and the kill switch (drop the
  Caddy block or stop the container) is independent of the dashboard.

Database side: per-person MySQL accounts pinned to the host's IP with DML-only
grants (no DDL, no GRANT) on the application schema, so queries audit to a named
person at a known IP in the binlog rather than to a shared app credential.
Credentials live in the password manager per-user, keeping web and database
identities 1:1. Least privilege is the default - the first account launched
read-only and was widened to DML by a single GRANT when its first task needed a
write.

## Consequences

**Positive.** One phishing-resistant gate now covers a growing family of internal
tools with ~40 lines of Caddyfile per app and zero new auth code; each new tool
inherits every future hardening of the dashboard's auth for free. Database actions
are attributable per person, and the whole thing is reversible in one Caddy reload.

**Accepted costs.** The dashboard session is the single gate, so its compromise
reaches the SQL tool - mitigated by passkeys, the 24-hour cap, and the sign-in
tripwire, but a real concentration of trust worth naming. The parent-domain cookie
is visible to every host on the domain; acceptable while all are first-party, and
the first thing to revisit if that stops being true. Stock-tool quirks surface
during setup (auth-provider header config, team/grant visibility, the local-login
password-hash format) - the price of not building.

## When I'd revisit

The proportionality rests on two facts: a tiny operator set, and every host on the
cookie's domain being first-party. Break either and the single-cookie gate is no
longer the right size. Past a handful of users, or the moment a subdomain on that
scope becomes third-party, the declined network boundary (Tailscale/WireGuard)
gets layered underneath, or the satellite apps graduate from a shared session to
per-app tokens (OIDC). And if the tool ever had to broker DDL or write paths
beyond a known few operators, the per-person-DML posture would move to reviewed,
logged, change-controlled access rather than direct workbench reach.
