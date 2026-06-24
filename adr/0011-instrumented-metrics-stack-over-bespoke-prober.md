# ADR 0011 - A pull-based metrics stack over a bespoke prober, with the data plane kept private

**Status:** Accepted · in production

## Context

[ADR 0007](0007-pull-probes-over-push-agents.md) chose a single bespoke service
that pulls health from the fleet and renders one page, and named when that would
stop being enough: *"rich per-process metrics, high-resolution history, or real
alerting SLAs tip the balance toward push-based agents and a proper time-series
database."*

All three arrived at once. A new revenue-adjacent service needed per-request
metrics (rate, errors, latency by route), the fleet outgrew "is it up?", and
"find out by looking at the page" needed to become "get paged." The bespoke
prober had reached its design limit.

The off-the-shelf answer is a metrics stack: Prometheus to scrape and store,
Grafana to visualize, Alertmanager to route notifications, plus exporters for
host and black-box signals. Every one of those components ships with **no
authentication**. On a host without a network firewall, the default
bind-to-all-interfaces means anyone who finds the port can read every metric you
collect - and the Alertmanager API lets them *silence or forge* your alerts.
Adopting the stack is half the decision; containing it is the other half.

## Decision

Adopt the stack, but keep the pull discipline and lock the data plane to
loopback:

- **Still pull, still agent-free for the apps.** Prometheus scrapes each app's
  `/metrics` over loopback and a black-box exporter probes public URLs from the
  one host. The apps gain a `/metrics` endpoint and otherwise own no monitoring
  code - the property 0007 valued.
- **Every unauthenticated component binds to `127.0.0.1`.** Prometheus,
  Alertmanager, node_exporter, and the black-box exporter are loopback-only,
  reached operationally over an SSH tunnel, never a public port.
- **Exactly one pane is public, and it is the one with auth.** Grafana sits
  behind the reverse proxy with TLS, anonymous access limited to **read-only**
  viewing and editing gated behind a login. It is the only component a browser
  can reach.
- **The whole thing is configured as code.** Scrape targets, alert rules, the
  datasource, and the dashboards are provisioned from files (see the companion
  [`observability/`](../observability/) module), not clicked together in a UI.

## Consequences

- **The capabilities 0007 lacked are now present:** per-request metrics with
  history, and alerts that actually notify (a route to email/chat), without a
  push agent inside the apps.
- **One public surface to defend, and it's read-only.** A leaked dashboard link
  exposes graphs, not control; the components that *can* be abused aren't
  reachable from off the host at all.
- **A real operational cost.** There is now a time-series database to run - a
  failure domain 0007 deliberately didn't have - and reaching the raw
  Prometheus/Alertmanager UIs means an SSH tunnel, not a URL. That friction is
  the price of not exposing an unauthenticated control plane.
- **The default is a trap, so it's written down.** "Binds to every interface
  with no auth" is not a footnote; on a firewall-less host it is a silent
  exposure. Binding to loopback is the mitigation, not obscurity of the port.

## When I'd revisit

A multi-node fleet where one Prometheus can't scrape everything tips toward
federation or remote-write. A compliance or team-size requirement to browse the
internal UIs without tunnels tips toward an authenticating proxy rather than
loopback. And needing reachability from several network vantage points tips the
black-box probing toward distributed agents - the same boundary 0007 named.
