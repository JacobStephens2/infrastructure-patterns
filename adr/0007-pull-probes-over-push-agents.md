# ADR 0007 — Pull-based health probing over push agents for a small fleet

**Status:** Accepted · in production

## Context

A modest fleet — a web host, a database, a cron/worker box, a handful of app
hosts — needs at-a-glance health visibility. The heavyweight default is a
monitoring stack with an agent installed on every node, each pushing metrics to
a central time-series store. For a fleet this size that's a lot of moving parts
— agents to install and keep upgraded on each box, a store to operate, and a new
failure domain — to answer a question that is mostly "is each service up and
within thresholds?"

## Decision

A single small service on the coordination host that *pulls*: it probes each
server's health endpoints and ports on a fixed interval and renders one page. No
agent runs on the monitored hosts — the probes use the network access the
coordination host already has. The little state it keeps is local and
single-node (see [ADR 0008](0008-embedded-sqlite-over-networked-db-for-tooling.md)).

## Consequences

- **Nothing to install on the fleet.** Adding or removing a server is a config
  change on one host; the monitored boxes stay clean and own no monitoring code.
- **One failure domain, and a legible one.** The prober either reaches a host or
  it doesn't — there's no "is the monitoring agent itself alive?" meta-problem
  layered on top of the thing you're trying to watch.
- **Costs:** pull only sees what it probes — no deep in-process metrics and no
  high-resolution history — and the prober is a single vantage point, so it
  watches reachability *from one place*.

## When I'd revisit

Rich per-process metrics, high-resolution history, or real alerting SLAs tip the
balance toward push-based agents and a proper time-series database. Needing to
see health from many network vantage points tips it toward distributed probing.
At this fleet size and with one trusted operator host, neither yet pays for
itself.
