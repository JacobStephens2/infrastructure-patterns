# ADR 0021 - A shared OpenTelemetry collector seam over direct backend wiring, metrics-only for Claude Code

**Status:** Accepted · in production (Phases 1-3 live across the fleet; Phase 4, PHP app tracing, prototyped on a staging host only)

## Context

[ADR 0011](0011-instrumented-metrics-stack-over-bespoke-prober.md) stood up the
standard metrics stack (Prometheus, Alertmanager, Grafana, per-node exporters)
for infrastructure health: hosts, databases, endpoints, certificates. That
answers "is the fleet healthy," but it says nothing about the work the fleet
actually does.

The largest unmeasured activity on this fleet is the AI coding agent itself.
Engineers run it interactively in tmux on roughly ten hosts, and an automation
host runs long-lived agent sessions of its own. None of that was instrumented:
there was no view of token consumption, session counts, model mix, or relative
cost across hosts and people. The runs are subscription-based rather than
API-billed, so there is no invoice to read after the fact either. "How much are
we using the agent, where, and on what" was unanswerable.

Separately, the in-house applications emit no traces. When a request is slow we
infer rather than observe.

OpenTelemetry is the vendor-neutral way to close both gaps with one pipeline. The
agent emits OTEL metrics natively; the apps can be instrumented with OTEL SDKs.
The question this ADR settles is how to receive, store, and surface that telemetry
without rebuilding what ADR 0011 already provides.

## Decision

Introduce a single **OpenTelemetry Collector** on the existing monitoring host as
the shared ingestion seam, and feed its output into the Prometheus and Grafana
stack already running there. The collector decouples what emits telemetry from
what stores it, so new sources (the agent now, apps later) and new backends (a
traces store later) are configuration changes, not new architecture.

Specific choices:

- **Metrics flow through the collector, not straight into Prometheus.** The
  pinned Prometheus can receive OTLP only behind a feature flag and binds to
  localhost; the collector receives OTLP on the private network and re-exposes a
  localhost Prometheus endpoint that the co-located Prometheus scrapes. This keeps
  the existing pull model intact and adds exactly one scrape job.

- **Agent telemetry is metrics-only. Logs are deliberately off.** The agent's OTEL
  *logs* stream can carry prompt and tool content; its *metrics* never do. The logs
  exporter is set to `none` explicitly. Counts and costs, never content.

- **Configuration is enforced per host via managed settings, not per user.** A
  single root-owned managed-settings file on each host sets the OTEL environment
  for every user that runs the agent there, and for any future user, with no shell
  profile edits. It is the highest-precedence settings layer, so it cannot be
  silently overridden.

- **Transport stays on the private network.** All hosts reach the collector over
  the peered cloud VPCs. The collector's OTLP ports are opened only to those
  private ranges via host-firewall rich rules, mirroring the default-deny host
  pinning of [ADR 0009](0009-default-deny-host-pinned-db-access.md). Nothing is
  exposed publicly.

- **Cardinality is bounded by expiration, not by dropping the session id.** The
  session id label is kept, because without it the session-count metric is
  uncountable: every short-lived process reports the value 1 onto one collapsed
  series, so the count never accumulates. The unbounded-growth risk is instead
  capped at the collector, whose Prometheus exporter expires a series 7 days after
  its last datapoint. That bounds live cardinality to a rolling 7-day window of
  sessions (small for this fleet) while making per-session token and cost
  accounting clean. Account id is also kept for per-person attribution. Session
  counts are queried as distinct session ids, never as a counter `increase()`,
  which reads zero on a constant-1 series.

- **Cost is labelled notional.** The agent's cost metric is computed from the
  vendor's API list prices. On subscription auth that is not money charged; it is
  an API-equivalent estimate. The dashboard and metric descriptions say so, so
  nobody reads the number as a bill. Its value is relative: comparing hosts,
  models, and trends over time.

For application tracing the same collector gains a traces pipeline feeding a
traces store (Grafana Tempo, the natural fit alongside Grafana). Apps are
instrumented with OTEL SDKs and point at the same collector.

## Phased rollout

1. **Collector plus agent metrics on the automation host.** Verified end to end:
   session, token, cost, and active-time series in Prometheus, labelled by host
   and model.
2. **Agent metrics across the fleet.** Managed settings deployed to all ten
   agent-running hosts; OTLP reachability confirmed from each; a starter Grafana
   dashboard is live. Already-running sessions begin exporting when next restarted
   (the OTEL env is read only at process start); new sessions export immediately.
3. **Application tracing.** The monitoring host was resized in place (no IP change)
   to give Tempo headroom. Tempo runs monolithic with local-disk blocks and 7-day
   retention; the collector forwards OTLP traces to it; Tempo is a Grafana
   datasource. Two FastAPI services are auto-instrumented via `opentelemetry-instrument`,
   and an LLM-proxy in front of one of them emits spans through its built-in `otel`
   callback. Traces are confirmed flowing and queryable.
4. **Legacy PHP app tracing.** Prototyped on a staging host that mirrors
   production, not yet on production. The `opentelemetry` PECL extension is built
   and loaded; the OTEL PHP SDK, OTLP exporter, and PDO auto-instrumentation are
   installed via Composer; a fail-safe `auto_prepend_file` bootstrap opens a
   SERVER root span per request; php-fpm passes the OTEL env (http/protobuf, since
   there is no grpc PHP extension). Request-level traces are confirmed.

   Key finding for the production decision: the app is overwhelmingly **mysqli**
   (roughly four times as many call sites as PDO), and there is no official mysqli
   auto-instrumentation, so out of the box we get the request span plus DB children
   only on PDO paths. Full query-level visibility would need custom mysqli hooks
   via the extension's hook API, or migrating those call sites. The prepend load
   also adds per-request overhead that matters more in production than on staging.
   Both make the production rollout a separate, deliberate decision, not a
   copy-paste of the prototype.

## Alternatives considered

- **Point the agent straight at Prometheus's OTLP receiver.** Rejected: it is
  feature-flagged and localhost-bound in the pinned version, gives no place to add
  traces or filtering later, and couples every emitter to Prometheus directly. The
  collector is the seam that pays off the moment a second signal or backend appears.
- **Per-user agent settings files.** Rejected: dozens of files across hosts and
  users, fragile, and silently missed by any new user. One managed file per host
  covers everyone.
- **Enable logs/prompt capture for richer detail.** Rejected for now on privacy
  grounds. Metrics answer the usage question without ever shipping prompt content
  off-host.
- **A hosted backend.** Rejected: the stack is already self-hosted, the data is
  small, and keeping it on the private network avoids a new external dependency and
  the egress of usage data.

## Consequences

- **Usage is finally visible.** Tokens, sessions, model mix, active time, and
  notional cost, sliced by host and person, with history and trend, not just a
  present-tense snapshot.
- **One seam for everything that comes next.** Adding app traces, a logs backend,
  or another emitter is collector configuration plus a scrape or store, not a new
  system.
- **The cost number needs its caveat repeated.** Anyone building an alert or report
  on the cost metric must remember it is notional under subscription billing. The
  label carries the warning; people still have to read it.
- **The monitoring host is now load-bearing for a second concern.** It hosts
  Prometheus, Alertmanager, Grafana, the collector, and now Tempo, and was resized
  for the traces store. Monitoring still must not share fate with what it watches,
  and trace volume now needs watching too (retention is capped to bound disk).
- **Telemetry is enforced, not opt-in.** Managed settings means every agent run on
  these hosts reports. That is the intent, documented here so it is not a surprise.
- **Restart is required to pick up telemetry.** Because the OTEL env is read at
  process start, sessions running at rollout time stay invisible until restarted;
  this surprised an operator into thinking the pipeline was broken. Worth saying
  out loud whenever telemetry is enabled on already-running, long-lived processes.

## Follow-ups

- Build trace-aware dashboards now that app and LLM-proxy spans exist (per-call
  latency and cost are the payoff).
- Consider an OTLP bearer token as defence in depth on top of the firewall scoping,
  weighed against the token sitting readable in managed settings, in the spirit of
  [ADR 0018](0018-runtime-injected-secrets-over-plaintext-config.md).
- Add alerts once a usage baseline exists (for example, an unusual cost or
  token-rate spike on a host).
