# ADR 0021 - A shared OpenTelemetry collector seam over direct backend wiring, metrics-only for Claude Code

**Status:** Accepted · in production (Phases 1-3 live across the fleet; Phase 4, PHP app tracing, prototyped on a staging host only)

## Context

[ADR 0011](0011-instrumented-metrics-stack-over-bespoke-prober.md) stood up the
standard metrics stack (Prometheus, Alertmanager, Grafana, per-node exporters)
for infrastructure health: hosts, databases, endpoints, certificates. That
answers "is the fleet healthy," not what the fleet actually does.

The largest unmeasured activity is the AI coding agent itself. Engineers run it
interactively in tmux on roughly ten hosts, and an automation host runs its own
long-lived agent sessions. None of it was instrumented: no view of token
consumption, session counts, model mix, or relative cost across hosts and people.
The runs are subscription-based rather than API-billed, so there is no invoice to
read either. Separately, the in-house apps emit no traces, so when a request is
slow we infer rather than observe.

OpenTelemetry closes both gaps with one vendor-neutral pipeline: the agent emits
OTEL metrics natively, the apps take OTEL SDKs. This ADR settles how to receive,
store, and surface that telemetry without rebuilding what ADR 0011 provides.

## Decision

Introduce a single **OpenTelemetry Collector** on the existing monitoring host as
the shared ingestion seam, feeding the Prometheus and Grafana stack already there.
The collector decouples what emits telemetry from what stores it, so new sources
(the agent now, apps later) and new backends (a traces store later) are
configuration changes, not new architecture.

- **Metrics flow through the collector, not straight into Prometheus.** The pinned
  Prometheus receives OTLP only behind a feature flag and binds to localhost, so the
  collector instead takes OTLP on the private network and re-exposes a localhost
  endpoint the co-located Prometheus scrapes - the pull model intact, one scrape job
  added.

- **Agent telemetry is metrics-only. Logs are deliberately off.** The agent's OTEL
  *logs* stream can carry prompt and tool content; its *metrics* never do, and the
  logs exporter is set to `none` explicitly. Counts and costs, never content.

- **Configuration is enforced per host via managed settings, not per user.** One
  root-owned managed-settings file per host sets the OTEL environment for every
  current and future agent user, no shell profile edits. As the highest-precedence
  layer it cannot be silently overridden.

- **Transport stays on the private network.** Hosts reach the collector over the
  peered cloud VPCs, and its OTLP ports open only to those private ranges via
  host-firewall rich rules, mirroring the default-deny host pinning of
  [ADR 0009](0009-default-deny-host-pinned-db-access.md). Nothing is exposed publicly.

- **Cardinality is bounded by expiration, not by dropping the session id.** Each
  session reports a constant 1, so dropping the session id label would collapse them
  onto one non-accumulating series; keeping it and querying distinct session ids (not
  `increase()`, which reads zero on a constant-1 series) counts them. The growth risk
  is capped at the collector instead, whose Prometheus exporter expires a series 7
  days after its last datapoint - bounding live cardinality to a rolling 7-day window
  (small for this fleet) while keeping per-session token and cost accounting clean.
  Account id is kept too, for per-person attribution.

- **Cost is labelled notional.** The agent's cost metric comes from the vendor's API
  list prices, so on subscription auth it is an API-equivalent estimate, not money
  charged, and the dashboard and metric descriptions say so. Its value is relative:
  hosts, models, and trends over time.

For application tracing the same collector gains a traces pipeline feeding a
traces store (Grafana Tempo, the natural fit alongside Grafana); apps point their
OTEL SDKs at the same collector.

## Phased rollout

1. **Collector plus agent metrics on the automation host.** Verified end to end:
   session, token, cost, and active-time series in Prometheus, labelled by host and
   model.
2. **Agent metrics across the fleet.** Managed settings deployed to all ten
   agent-running hosts; OTLP reachability confirmed from each; a starter Grafana
   dashboard is live.
3. **Application tracing.** The monitoring host was resized in place (no IP change)
   to give Tempo headroom. Tempo runs monolithic with local-disk blocks and 7-day
   retention, fed OTLP traces by the collector and wired as a Grafana datasource.
   Two FastAPI services are auto-instrumented via `opentelemetry-instrument`, and an
   LLM-proxy in front of one emits spans through its built-in `otel` callback.
   Traces are confirmed flowing and queryable.
4. **Legacy PHP app tracing.** Prototyped on a staging host that mirrors
   production. The `opentelemetry` PECL extension is built and loaded; the OTEL PHP
   SDK, OTLP exporter, and PDO auto-instrumentation come in via Composer; a fail-safe
   `auto_prepend_file` bootstrap opens a SERVER root span per request; php-fpm passes
   the OTEL env (http/protobuf, since there is no grpc PHP extension). Request-level
   traces are confirmed.

   Key finding for the production decision: the app is overwhelmingly **mysqli**
   (roughly four times as many call sites as PDO), which has no official
   auto-instrumentation, so out of the box we get DB children only on PDO paths;
   full query-level visibility would need custom mysqli hooks via the extension's
   hook API, or migrating those call sites. The prepend load also adds per-request
   overhead that matters more in production than on staging. Both make the
   production rollout a separate, deliberate decision, not a copy-paste.

## Alternatives considered

- **Point the agent straight at Prometheus's OTLP receiver.** Rejected: in the
  pinned version it is feature-flagged and localhost-bound, gives no place to add
  traces or filtering later, and couples every emitter to Prometheus directly.
- **Per-user agent settings files.** Rejected: dozens of fragile files, silently
  missed by any new user. One managed file per host covers everyone.
- **Enable logs/prompt capture for richer detail.** Rejected for now on privacy
  grounds. Metrics answer the usage question without shipping prompt content
  off-host.
- **A hosted backend.** Rejected: the stack is already self-hosted and the data is
  small, so staying on the private network avoids a new external dependency and the
  egress of usage data.

## Consequences

- **Usage is finally visible.** Tokens, sessions, model mix, active time, and
  notional cost, sliced by host and person, with history and trend.
- **The cost caveat must be repeated.** Anyone building an alert or report on the
  cost metric must remember it is notional under subscription billing. The label
  carries the warning, but people still have to read it.
- **The monitoring host is now load-bearing for a second concern.** It runs
  Prometheus, Alertmanager, Grafana, the collector, and now Tempo, resized for the
  traces store. Monitoring still must not share fate with what it watches, and trace
  volume now needs watching too (retention is capped to bound disk).
- **Telemetry is enforced, not opt-in.** Managed settings means every agent run on
  these hosts reports - intended, documented here so it is not a surprise.
- **Restart is required to pick up telemetry.** Because the OTEL env is read at
  process start, sessions running at rollout time stay invisible until restarted;
  this surprised an operator into thinking the pipeline was broken. Worth saying out
  loud whenever telemetry is turned on for already-running, long-lived processes.

## Follow-ups

- Build trace-aware dashboards now that app and LLM-proxy spans exist (per-call
  latency and cost are the payoff).
- Consider an OTLP bearer token as defence in depth over the firewall scoping,
  weighed against the token sitting readable in managed settings, in the spirit of
  [ADR 0018](0018-runtime-injected-secrets-over-plaintext-config.md).
- Add alerts once a usage baseline exists (an unusual cost or token-rate spike on a
  host, say).
