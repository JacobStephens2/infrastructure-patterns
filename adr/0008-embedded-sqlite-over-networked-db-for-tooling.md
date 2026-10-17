# ADR 0008 - Embedded SQLite over a networked database for single-node tooling

**Status:** Accepted · in production (single-host operational state; console and worker share one application database)

## Context

Internal tooling on the coordination host - the health dashboard's cache, a
little operational state, a deploy log - needs to persist a small amount of
data. [ADR 0002](0002-external-managed-db-over-containerized.md) argued *for* an
external managed database, but that was about the product's durable, shared,
business-critical state. This is the opposite case: small, single-node state
owned by one application on one box, where a database server would add a
daemon, a port, and a set of grants to manage in exchange for nothing.

## Decision

Use an embedded SQL database (SQLite) - a file on local disk - for this tier. No
server, no network, no separate lifecycle. The tooling opens a file and gets
transactions and SQL.

## Consequences

- **No database server to operate.** The local state still needs a consistent
  backup, but there is no separate daemon, listener, or database account to
  maintain. The tooling has no database network dependency that can fail
  independently of the tooling itself.
- **Right-sized concurrency.** One writer and light reads is exactly SQLite's
  sweet spot - real SQL and transactions without operating a server to get them.
- **Costs:** the data doesn't leave the box (no shared access from other hosts)
  and write concurrency is limited - both fine here, and both disqualifying
  elsewhere.

## When I'd revisit

The moment the data must be shared across hosts, have a durability lifecycle
independent of this node, or sustain write contention beyond local
serialization, revisit the separately managed tier of ADR 0002. The deciding
question is *who owns the state* - one application on one host, or the business -
not how many rows it is.

## Amendment - 2026-10-16

The operations console and its deployment worker now share the local SQLite
history. The connection uses WAL so observers can read while the worker
writes, with a bounded busy timeout. One application can have two processes;
that does not itself require a network database. Their common code and schema
are part of why they deploy as one release in
[ADR 0059](0059-two-processes-one-release-refuse-when-they-disagree.md).
