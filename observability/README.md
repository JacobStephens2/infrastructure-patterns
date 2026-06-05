# observability/

The concrete, sanitized companion to
[ADR 0011](../adr/0011-instrumented-metrics-stack-over-bespoke-prober.md): a
pull-based metrics stack (Prometheus + Grafana + Alertmanager + node/blackbox
exporters) configured as code, with every unauthenticated component on loopback
and one read-only Grafana pane public.

The rest of this repo is generalized ADRs - reasoning without code. This
directory is the exception: the config and dashboards that make the pattern in
0011 reproducible. It is generalized too - **no real hostnames, addresses, or
credentials** (substitute your own; the SMTP password must come from a secret).

## Layout

```
prometheus/
  prometheus.yml        scrape config: app /metrics + node + blackbox; loopback only
  alerts.rules.yml      service-down, disk, site-down, cert-expiry, app error-rate
alertmanager/
  alertmanager.yml      email routing (STARTTLS on 587; password from a secret)
grafana/
  provisioning/         datasource + dashboard providers (provision-as-code)
  dashboards/
    app-service.json    one app: request rate / status / latency / error ratio
    fleet-overview.json site up/down + service up/down + latency + cert days
    host-overview.json  CPU / memory / disk / load / network
```

## Notes that cost time to learn

- **Bind everything but Grafana to `127.0.0.1`.** These tools have no auth; the
  default binds to all interfaces. On a firewall-less host that is a silent
  exposure (read all metrics; the Alertmanager API can silence/forge alerts).
- **node_exporter's `--collector.systemd.unit-include` is full-match**, so a
  service filter must include the `\.service` suffix or it silently matches
  nothing - which looks identical to "the collector is broken."
- **A bind-mounted volume may only appear under its bind path** in
  node_exporter, not its real mountpoint - query it by `device=...`.
- **Every Grafana panel target needs a unique `refId`** (A, B, C…); duplicate
  refIds make a multi-series panel render "No data."
- **Provisioned Grafana dashboards drop `__inputs`** and reference the datasource
  by a fixed `uid` (here `prometheus`) instead of a template variable.

## Apply (sketch)

Drop `prometheus/*` into `/etc/prometheus/`, `alertmanager.yml` into the
Alertmanager config path, the `grafana/provisioning/*` into
`/etc/grafana/provisioning/`, and the dashboard JSON into the path the dashboard
provider points at. Reload each service. The exporters (`node_exporter`,
`blackbox_exporter`) listen on loopback; Prometheus scrapes them.
