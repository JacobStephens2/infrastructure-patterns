# Case study - a group-travel platform, modernized in production and then opened to agents

**Status:** Sanitized. Names, hostnames, tenant identifiers, credentials, and
vendor account details are removed or generalized. Every figure below is one I
have published elsewhere under my own name; nothing here is estimated for
effect.

A companion to the ADRs in [`../adr/`](../adr/). The ADRs answer *what did you
decide, and why*. This answers *what did the system look like before, what does
it look like now, and what changed that mattered*.

---

## Four environments, four purposes

- A **Manager Sandbox** is a role-specific instance of the platform running in
  a Docker container. Managers use these isolated copies to explore data and
  prototype changes before human-reviewed promotion.
- The **Unattended Loop** is a single-operator coding loop that runs each agent
  iteration in a fresh microVM and opens a draft pull request with nobody
  watching.
- A **Factory Worker** is one agent attempt in a separate, heavier agent
  factory, running inside a short-lived Firecracker microVM. It is not a
  Manager Sandbox, and nothing in this case study depends on it.
- The **Kubernetes Demo** is a separate single-node k3s learning and portfolio
  environment. It is not part of production, and nothing here runs on it.

## The system I inherited

A full-lifecycle ERP for a group-travel operator: sales pipeline, itinerary
building, reservations, passenger logistics, payments, communications, and more
than 70 reports, with three customer- and contractor-facing portals on the same
core. Office staff work in it all day. Tour guides use an offline-capable
portal in the field.

- **Stack:** PHP 5.6, MySQL 5.7, CentOS 7, all at or near end of support.
- **Shape:** a twenty-year-old monolith whose repository root was also its
  document root, four portals sharing one schema.
- **Operations:** deploy in place, no CI, a bespoke status page that answered
  "is it up?" and nothing else, credentials in plaintext config, SSH on the
  public internet.

It worked, and every other part of the business depended on it staying up. The
rewrite everyone would have liked was not going to happen: the domain logic in
the schema and the procedures *is* the business.

## The problem

Modernize the platform in production, without a freeze. Then add AI-assisted
automation on top, for non-technical managers and for engineering work, without
letting the automation or the people configuring it take the reservation
system down.

That second constraint - *safe AI automation against a revenue-critical legacy
system* - is the seam most of the ADRs sit on.

## What changed

### 1. The stack, with no outage anyone noticed

A codebase-wide PHP 5 to 8 migration, MySQL 5.7 to 8.4 with both databases
running through the cutover, and a CentOS 7 to Rocky Linux 9 fleet migration
with a runbook per server, while still shipping features. This is what made
everything after it possible.

### 2. A deploy path that refuses bad deploys

A guarded server-side deploy for the monolith
([0004](../adr/0004-shell-deploy-over-hosted-ci-runner.md)), a shared serving
checkout pinned fast-forward-only so the newest commit can never carry the
oldest content
([0029](../adr/0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md)),
immutable per-commit releases with atomic promotion for the internet-facing
console ([0030](../adr/0030-immutable-releases-atomic-promotion-append-only-journal.md)),
and a webroot allowlist that returns 404 for anything nobody anticipated
([0034](../adr/0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md)).

### 3. Secrets out of files, and the perimeter sized to who uses it

Secrets are encrypted at rest and injected at runtime
([0018](../adr/0018-runtime-injected-secrets-over-plaintext-config.md)), with
one manifest per consumer after a shared manifest took four units down for six
hours ([0028](../adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md)).
Operator shells moved behind a private mesh while the browser consoles
non-technical staff reach by URL stayed public behind MFA
([0020](../adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md)).

### 4. Measurement before optimization

A standard metrics stack replaced the bespoke prober for anything that needs
history ([0011](../adr/0011-instrumented-metrics-stack-over-bespoke-prober.md)),
then traces and logs behind one collector seam
([0021](../adr/0021-shared-collector-seam-over-direct-backend-wiring.md),
[0022](../adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md)).
The payoff was that performance work stopped being anecdotal.

### 5. Manager Sandboxes

Each manager gets a role-specific instance in a Docker container
([0001](../adr/0001-docker-over-bare-metal-for-tenant-isolation.md)), over a
database refreshed every few hours from a production mirror and never the
primary ([0003](../adr/0003-periodic-snapshot-over-live-replication.md)), under
a scoped identity ([0005](../adr/0005-scoped-system-user-over-service-account.md))
with default-deny, host-pinned database grants
([0009](../adr/0009-default-deny-host-pinned-db-access.md)). Agent command
execution is allowlist-constrained, AI work lands on a per-role branch, and
promotion is a manual step by a human.

### 6. Unattended agents, with one boundary re-earned

When nobody is watching, "I notice and fix" stops being true, so the execution
boundary comes back as a per-iteration microVM and almost nothing else does
([0023](../adr/0023-attendedness-is-a-fourth-trust-axis.md)). The loop's reach
is a short, asserted credential inventory
([0024](../adr/0024-asserted-credential-inventory-is-the-isolation-seam.md)),
its throughput is bounded by my review queue rather than a spend cap
([0036](../adr/0036-review-capacity-over-a-daily-spend-cap-for-unattended-dispatch.md)),
and a task with no test suite still gets mechanical backpressure
([0037](../adr/0037-completeness-check-derives-its-own-denominator.md)).

## Measured outcomes

- **2,650 to 183 SQL statements per render** of the group manifest page, the
  page printed before every trip. Load time went from 5-7 seconds to about 1,
  across six profile-driven rounds, each verified byte-identical against the
  original HTML and validated on a 244-sub-reservation outlier group.
- **About 80% of measured database query time removed by three composite
  indexes.** Ranking 27 days of production queries by total time showed three
  full-table-scan queries dominating: roughly 404,000 of 500,000
  query-seconds. The indexes were applied as online DDL, `EXPLAIN`-verified,
  with the rollback written first. The remaining load was diagnosed as
  application-level N+1 volume rather than papered over with hardware.
- **One dashboard aggregate from 1,441 seconds to 0.196**, after an incident
  caused by my own read rule
  ([0042](../adr/0042-read-the-union-view-inline-it-for-aggregates-lint-the-shape.md)).
- **14 manager-prototyped features shipped to production** through the human
  merge gate.
- **14 hosts instrumented** with node, database, and black-box exporters, with
  the rule-to-SMS paging chain verified live before the old pager was cut over.
- **100+ scheduled jobs** under a file-based cron registry with a drift
  monitor.
- **In the field this season:** 77 guides on the offline-capable guide portal,
  3,300+ traveler SMS sent from it, and about $154K of guide expenses
  reconciled through it.

## What I got wrong, and what each one changed

Three mistakes, each written up because it was cheap to make and invisible
afterward.

- **Isolation was inferred from a config file.** A preview tier held a live
  transactional-email key and production SMS credentials behind a per-slot
  override file that was present, well-formed, and never read. Isolation is now
  established by an egress test and the resolved container configuration, and
  a slot is not called contained until that passes
  ([0046](../adr/0046-preview-containment-in-the-application-proved-by-egress-test.md)).
- **I verified correctness where cost was the risk.** The aggregates behind the
  1,441-second incident were checked on a preview database that does not carry
  production's volume. Every result was right. The fix is a lint test on query
  shape, because no behavioral test can see a cost that depends on volume
  ([0042](../adr/0042-read-the-union-view-inline-it-for-aggregates-lint-the-shape.md)).
- **I accepted a trade-off on the strength of a mitigation I then did not
  build.** A record of approvals lived in one database on one machine, and the
  backup that made that acceptable never existed. I reversed the decision
  fifteen days later
  ([0045](../adr/0045-append-only-jsonl-in-git-as-the-only-record.md)). A
  mitigation that has not run once is not one.

## What generalizes

The ADRs generalize; this specific system does not need to. If you are running
a long-lived line-of-business system that funds the payroll, are being asked to
add AI-assisted automation on top, and cannot fund the rewrite, the pattern is:

- sandbox first, and feed the sandbox a snapshot rather than a replica;
- pin credentials to a host and enumerate them, so reach is a list you can read;
- decide what changes when nobody is watching, and re-earn only that;
- bound the agent by human review capacity, because that is the scarce thing;
- gate changes on evidence a human can accept quickly;
- prove isolation and mitigations by running them, never by their presence.

---

*Written by Jacob Stephens. Sanitized for public distribution; the underlying
system is not open source and its private repositories are not linked from
here.*
