# ADR 0008 - Embedded SQLite over a networked database for single-node tooling

**Status:** Accepted · in production

## Context

Internal tooling on the coordination host - the health dashboard's cache, a
little operational state, a deploy log - needs to persist a small amount of
data. [ADR 0002](0002-external-managed-db-over-containerized.md) argued *for* an
external managed database, but that was about the product's durable, shared,
business-critical state. This is the opposite case: small, single-node state
owned by one process on one box, where reaching for a database server would add
a daemon, a port, and a set of grants to manage in exchange for nothing.

## Decision

Use an embedded SQL database (SQLite) - a file on local disk - for this tier. No
server, no network, no separate lifecycle. The tooling opens a file and gets
transactions and SQL.

## Consequences

- **Zero operational surface.** Nothing to run, expose, or grant; backup is
  copying a file. The tooling has no network dependency that can be down
  independently of the tooling itself.
- **Right-sized concurrency.** One writer and light reads is exactly SQLite's
  sweet spot - real SQL and transactions without operating a server to get them.
- **Costs:** the data doesn't leave the box (no shared access from other hosts)
  and write concurrency is limited - both fine here, and both disqualifying
  elsewhere.

## When I'd revisit

The moment the data must be shared across hosts, outlive the node, or take
concurrent writers, it belongs in the managed tier of ADR 0002. The deciding
question is *who owns the state* - one process on one host, or the business -
not how many rows it is.
