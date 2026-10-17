# ADR 0011 - A pull-based metrics stack alongside a bespoke prober, with the data plane kept private

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
prober needed history and alerting beside it; it still served liveness and
operator actions.

The off-the-shelf answer is a metrics stack: Prometheus to scrape and store,
Grafana to visualize, Alertmanager to route notifications, plus exporters for
host and black-box signals. The metrics and alert-control endpoints have
**no authentication**: Prometheus, Alertmanager, and the exporters need a
network boundary. Without one, a public listener lets anyone who finds its
port read metrics - and the Alertmanager API lets them *silence or forge*
alerts. Grafana has its own login.
Adopting the stack is half the decision; containing it is the other half.

## Decision

Adopt the stack, but keep the pull discipline and lock the data plane to
loopback:

- **Still pull, still no push agent inside the apps.** Prometheus scrapes
  metrics endpoints, and a black-box exporter probes public URLs from the
  monitoring host. Fleet exporters accept scrapes only from that host, pinned
  by the host firewall. The bespoke prober stays alongside the stack.
- **The co-located data and control plane binds to `127.0.0.1`.** Prometheus,
  Alertmanager, and the black-box exporter are reached operationally over an
  SSH tunnel. Remote exporters use the host-pinned access above.
- **Exactly one pane is reachable from a browser, behind a login.** Grafana
  sits behind the reverse proxy with TLS. Its live instance requires a login;
  the public companion is a baked dashboard image.
- **The whole thing is configured as code.** Scrape targets, alert rules, the
  datasource, and the dashboards are provisioned from files (see the companion
  [`observability/`](../observability/) module), not clicked together in a UI.

## Consequences

- **The capabilities 0007 lacked are now present:** per-request metrics with
  history, and alerts that actually notify (a route to email/chat), without a
  push agent inside the apps.
- **One authenticated browser surface to defend.** The raw metrics and alert
  control APIs remain off the public internet. Dashboard links do not bypass
  the login.
- **A real operational cost.** There is now a time-series database to run - a
  failure domain 0007 deliberately didn't have - and reaching the raw
  Prometheus/Alertmanager UIs means an SSH tunnel, not a URL. That friction is
  the price of not exposing an unauthenticated control plane.
- **The default is a trap, so it's written down.** "Binds to every interface
  with no auth" is not a footnote; on a firewall-less host it is a silent
  exposure. Binding to loopback is the mitigation, not obscurity of the port.

## Amendment - 2026-10-16

The earlier anonymous-read claim was wrong: the live Grafana instance stays
behind a login. The stack also runs alongside the bespoke prober, rather
than replacing it. Remote exporters are pinned to the monitoring host; the
loopback rule applies to the co-located backends and control APIs.

## When I'd revisit

A multi-node fleet where one Prometheus can't scrape everything tips toward
federation or remote-write. A compliance or team-size requirement to browse the
internal UIs without tunnels tips toward an authenticating proxy rather than
loopback. And needing reachability from several network vantage points tips the
black-box probing toward distributed agents - the same boundary 0007 named.
