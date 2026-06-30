# ADR 0022 - Complete the logs pillar with a co-located local-disk Loki behind the collector seam, over a dedicated or hosted log stack

**Status:** Accepted · in production (Loki live on the monitoring host; the monitoring host's own journald shipping end to end; fleet sources sequenced by debugging value)

## Context

[ADR 0011](0011-instrumented-metrics-stack-over-bespoke-prober.md) gave us
metrics; [ADR 0021](0021-shared-collector-seam-over-direct-backend-wiring.md)
added the OpenTelemetry collector seam and, through it, traces (Tempo). That
left one of the three observability pillars missing: **logs**. Debugging an
incident across the 16-host fleet still meant SSH-ing into the right box and
grepping `journalctl` or an Apache `error_log` by hand, and a Tempo span could
tell us *where* a request broke but not *why* - the line that explains it lived
in a file on the host, unindexed and uncorrelated.

The natural fit alongside Grafana + Tempo is Loki: same query surface, same
datasource model, and native trace-to-logs correlation. The open questions were
where it runs, how logs reach it, how long they live, and how to add it without
re-opening the privacy line ADR 0021 drew.

One constraint from 0021 carries forward and must not be quietly reversed: the
**coding agent's** OTEL *logs* stream (which can carry prompt and tool content)
is deliberately off. Standing up a logs *backend* is about infrastructure and
application logs - journald, Apache/PHP errors, the MySQL slow-query log - not
about resurrecting prompt capture.

## Decision

Add **Grafana Loki, single-binary, on the existing monitoring host**, ingested
**only through the collector seam** from [ADR 0021](0021-shared-collector-seam-over-direct-backend-wiring.md),
and keep it private on localhost. Concretely:

- **Loki binds to `127.0.0.1` and is never exposed**, not even on the VPC.
  Fleet hosts ship logs to the collector's existing OTLP receiver - the same
  VPC-firewalled ingress metrics and traces already use - and the collector's
  logs pipeline forwards them to Loki's OTLP endpoint on localhost. One ingress,
  one firewall surface, the store private. This is the seam from 0021 carrying a
  third signal, and the public/private boundary discipline from
  [ADR 0020](0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md):
  expose nothing that nothing off-box needs to reach.

- **Co-located on the one monitoring node, local-disk, frugal retention.** Loki
  runs next to Prometheus, Alertmanager, Grafana, the collector, and Tempo, the
  same native-binary + systemd + dedicated-user pattern as Tempo. Storage is
  local disk with a TSDB index and a compactor enforcing **31-day** retention -
  the same frugality as Tempo's 7-day blocks, sized up because logs are the
  pillar people search backward through. Object storage is the documented escape
  hatch, not the starting point.

- **Per-tenant ingestion guardrails.** The shared box is the thing to protect, so
  Loki caps ingestion (8 MB/s, 16 MB burst, 5000 streams) - an app log-storm
  throttles instead of OOM-ing a node that also runs the fleet's alerting.

- **System and application logs only; the agent privacy line holds.** journald,
  Apache/PHP, Caddy access, the MySQL slow-query log. The agent's prompt-bearing
  logs stay off, exactly as 0021 set them.

- **Sources are sequenced by debugging value, not by host.** The monitoring
  host's own journald first (proves the pipeline end to end), then the
  highest-payoff sources - tourbot prod Apache/PHP errors, the MySQL slow-query
  log (so slow-query *rate* charts beside the DB-CPU graphs from the ongoing N+1
  work), then journald fleet-wide for auth/SSH visibility, which is where the
  security and PCI value sits.

The droplet was resized first (4 GB -> 8 GB, plus a swapfile) so the third pillar
has headroom rather than crowding the alerting it shares a box with.

## Alternatives considered

- **A dedicated logging droplet / separate stack (ELK, Loki on its own host).**
  Rejected for now: a second box to run, patch, and watch, and it forfeits the
  cheap win - Loki beside Grafana + Tempo gives native trace-to-logs and one
  query surface with zero new infrastructure. Single-node until it hurts; the
  escape hatch is real and written down.

- **A hosted log backend (Grafana Cloud, Datadog, etc.).** Rejected on the same
  grounds as 0021's hosted-backend rejection: the stack is already self-hosted,
  the data is small, and shipping fleet logs - including auth and access logs -
  to a third party is exactly the egress we avoid elsewhere. Keep the
  authoritative copy on infra we govern.

- **Fleet hosts push straight to Loki.** Rejected: it would force Loki onto the
  VPC with its own firewall rule and auth, duplicating the ingress the collector
  already provides. Routing through the seam keeps Loki on localhost and means
  one place to scope, batch, and relabel.

- **Direct Prometheus-style scrape of log files into existing tooling.**
  Rejected: logs are not metrics; the point is full-text search and label
  selection over the raw lines, which is what Loki exists to do.

## Consequences

- **The third pillar exists.** Logs are centralized, label-selectable, and
  retained 31 days, queryable from the same Grafana that holds metrics and
  traces - no more SSH-and-grep to read a single incident's logs.

- **The monitoring host is even more load-bearing.** It now runs six telemetry
  services. The single-box blast radius is the standing cost of co-location: when
  this node is down or being resized, the fleet is briefly unmonitored *and*
  un-log-shipped *and* un-alerted at once. It still must not share fate with what
  it watches, and now disk and Loki memory need watching too. The swapfile is a
  cushion, not a capacity plan.

- **Retention is a deliberate ceiling, not a default.** 31 days of local-disk
  logs is below the ~1-year audit-log retention PCI guidance points at. When a
  compliance or volume need crosses that line, the answer is object storage
  (DO Spaces) for chunks with a longer `retention_period`, not a bigger disk -
  flagged here so the limit is a decision, not a surprise.

- **Trace-to-logs is wired by configuration, not new architecture** - the
  dividend of the seam. The Tempo datasource gains a logs link to Loki; a span
  jumps to that request's lines.

- **The agent privacy line now has to be restated whenever logs come up.** A logs
  backend exists; the reflex "so turn on the agent's logs" must keep meeting the
  same "no, metrics only" from 0021. Documented here so the backend's existence
  doesn't quietly erode the decision.

## Follow-ups

- Ship the high-value sources (tourbot prod Apache/PHP, MySQL slow-query log),
  then journald fleet-wide, via per-host shippers (Grafana Alloy or otelcol)
  exporting OTLP to the collector - never direct to Loki.
- Convert the Tempo datasource to file provisioning alongside Loki so the
  trace-to-logs link is codified, and add a Prometheus scrape of Loki's own
  `/metrics` (self-monitoring).
- Loki ruler alerts on log patterns (PHP fatals, repeated auth failures) into the
  Alertmanager already on the box, once a baseline exists.
- Decide the object-storage cutover *before* a PCI or volume need forces it, in
  the spirit of [ADR 0015](0015-state-off-the-provider-it-provisions.md): know
  where the durable copy goes ahead of time.
