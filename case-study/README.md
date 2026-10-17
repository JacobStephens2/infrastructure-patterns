# Case study - a group-travel platform, modernized in production and then opened to agents

**Status:** Sanitized. Names, hostnames, tenant identifiers, credentials, and
vendor account details are removed or generalized. Business-outcome figures
are already published under my own name; engineering measurements are traced
to the source records. Nothing here is estimated for effect.

A companion to the ADRs in [`../adr/`](../adr/). The ADRs answer *what did you
decide, and why*. This answers *what did the system look like before, what does
it look like now, and what changed that mattered*.

---

## The environments and their evidence boundaries

- A **Manager Sandbox** is a role-specific instance of the platform running in
  a Docker container. Managers use separate application containers over shared
  sandbox data to explore and prototype changes before human-reviewed promotion.
- **thirdshift** is the open-source issue-to-pull-request factory used for
  engineering work. Its production records cover review evidence, CI decisions,
  and repository merge policy
  ([0053](../adr/0053-a-review-finding-carries-a-failing-test-and-a-decline-cites-the-run.md),
  [0054](../adr/0054-merge-the-exact-head-whose-ci-was-watched-over-platform-auto-merge.md)).

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

A guarded server-side script executes the monolith's deploys
([0004](../adr/0004-shell-deploy-over-hosted-ci-runner.md)). Since 2026-10-15,
GitHub Actions automatically requests a deploy on a default-branch push; the
host rechecks authority, the commit, CI, and live state before acting
([0058](../adr/0058-the-hosted-runner-asks-and-the-host-decides.md)).

The fleet's shared serving checkout is pinned fast-forward-only, refuses to
advance while dirty, and uses a stale-path guard on commits
([0029](../adr/0029-pin-the-serving-checkout-fast-forward-only-edit-in-worktrees.md)).
The operations console and its deploy worker run one immutable release and
refuse production work when their revisions disagree
([0059](../adr/0059-two-processes-one-release-refuse-when-they-disagree.md)).
The application's webroot allowlist returns 404 for unexpected entrypoints
([0034](../adr/0034-root-allowlist-with-404-over-blocklist-with-403-for-a-legacy-webroot.md)).

### 3. Secrets out of files, and the perimeter sized to who uses it

Secrets are encrypted at rest and injected at runtime
([0018](../adr/0018-runtime-injected-secrets-over-plaintext-config.md)), with
one manifest per consumer after a shared manifest took four units down for six
hours ([0028](../adr/0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md)).
Operator shells moved behind a private mesh while the browser consoles
non-technical staff reach by URL stayed public behind login. The operations
session uses passkeys and can gate a second app through forward_auth
([0019](../adr/0019-reuse-passkey-session-forward-auth-over-second-auth-stack.md))
([0020](../adr/0020-private-mesh-for-shells-mfa-gated-public-endpoints-for-browsers.md)).

### 4. Measurement before optimization

A standard metrics stack added history and alerting alongside the bespoke
prober ([0011](../adr/0011-instrumented-metrics-stack-over-bespoke-prober.md)),
then traces and logs behind one collector seam
([0021](../adr/0021-shared-collector-seam-over-direct-backend-wiring.md),
[0022](../adr/0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md)).
The payoff was that performance work stopped being anecdotal.

### 5. Manager Sandboxes

Each manager gets a role-specific application container
([0001](../adr/0001-docker-over-bare-metal-for-tenant-isolation.md)), with
separate files and processes over one shared writable sandbox database. The
database is refreshed nightly, with per-manager credentials
([0003](../adr/0003-periodic-snapshot-over-live-replication.md)). This makes
refreshes cheaper and lets one manager's database experiments affect the
others. It is application isolation, not per-manager data isolation.

A scoped identity attributes work
([0005](../adr/0005-scoped-system-user-over-service-account.md)); host-pinned
grants constrain database access
([0009](../adr/0009-default-deny-host-pinned-db-access.md)). A separate
SELECT-only path reads production on the primary under account limits and a
server-side query killer
([0057](../adr/0057-a-sandbox-reads-the-primary-not-a-replica-that-can-stall-silently.md)).
Code promotion goes through pull requests and engineering review.

### 6. Review evidence in the coding workflow

thirdshift asks reviewers for runnable evidence, requires a correctness
finding's test to be run before the author resolves it, and keeps declined
findings and unread files visible
([0053](../adr/0053-a-review-finding-carries-a-failing-test-and-a-decline-cites-the-run.md)).
A feature's tickets meet on one branch before whole-feature review
([0056](../adr/0056-a-features-tickets-merge-into-one-branch-so-review-happens-once.md)).
The target repository's merge policy controls whether a ready pull request
still needs human approval.

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
- **30+ pull requests merged by engineering** from a manager workflow. This
  counts merged pull requests, not commits, distinct features, or formal review
  approvals; it is the published lower bound.
- **14 hosts instrumented in the initial rollout** with node, database, and
  black-box exporters, with the rule-to-SMS paging chain verified live before
  the old pager was cut over.
- **100+ scheduled jobs** under a file-based cron registry with a drift
  monitor.
- **In the original June 2026 usage snapshot:** 77 guides on the
  offline-capable guide portal, 3,300+ traveler SMS sent from it, and about
  $154K of guide expenses reconciled through it. These are retained snapshot
  figures, not current-season totals.

## What I got wrong, and what each one changed

Two mistakes, each written up because it was cheap to make and invisible
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

## What generalizes

The ADRs generalize; this specific system does not need to. If you are running
a long-lived line-of-business system that funds the payroll, are being asked to
add AI-assisted automation on top, and cannot fund the rewrite, the pattern is:

- sandbox first, and feed the sandbox a snapshot rather than a replica;
- pin credentials to a host and enumerate them, so reach is a list you can read;
- make review findings answer to runnable evidence, and deferred decisions to
  tracked work;
- choose a useful review unit, so a feature's tickets do not each require a
  separate human review;
- gate changes on evidence a human can accept quickly;
- prove isolation and mitigations by running them, never by their presence.

---

*Written by Jacob Stephens. Sanitized for public distribution; the underlying
system is not open source and its private repositories are not linked from
here.*
