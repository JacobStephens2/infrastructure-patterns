# ADR 0015 - Keep Terraform state off the provider it provisions

**Status:** Accepted · in production

## Context

Terraform records what it manages in a state file that has to live somewhere
durable and lockable. The compute it describes - a droplet, a block volume, the
DNS in front of them - runs on one cloud provider that also sells an
S3-compatible object store, so the path of least resistance is a bucket on the
same account: one vendor, one set of credentials, one bill.

That convenience hides a coupling. State matters most when you need to rebuild,
and the most total failure is losing the provider itself: a region outage, a
billing lock, a suspended account. State on that same provider means the one event
takes out both the infrastructure *and* the record of how to recreate it. Same
instinct as not storing the only backup on the machine being backed up: recovery
state should not share a failure domain with the thing it recovers.

## Decision

Put the state on a *different* provider than the compute it describes.

- **State lives in AWS S3; the compute lives on DigitalOcean.** A DigitalOcean
  outage or account lock leaves the state fully reachable on AWS, so a rebuild can
  proceed. The two fail independently.
- **Locking is S3-native** (`use_lockfile`, conditional writes), so there is no
  second piece of infrastructure - no DynamoDB table - to stand up just to
  serialize applies.
- **Credentials are scoped to the one bucket** (an IAM policy with `ListBucket` +
  `Get/Put/DeleteObject` on that bucket only), injected from the environment,
  never committed.
- **The bucket is versioned**, so a botched `migrate-state` or a bad apply can roll
  back to a prior state object.

## Consequences

- **A single-provider failure no longer destroys the means of recovery.** The
  reason for the whole exercise, bought cheaply.
- **State is effectively free and the locking is simpler.** A state file is
  kilobytes - a rounding error on S3 rather than an object-store's monthly floor -
  and `use_lockfile` removes the DynamoDB table the S3 backend used to need.
- **A second vendor and a second credential to manage.** Real added surface: an AWS
  account, an IAM user, a key in CI. The price of independence; the key is
  read/write to exactly one bucket and nothing else.
- **The choice generalizes past disaster recovery.** Off-provider state also lets
  CI run `plan` without trusting the compute provider's account, and keeps the state
  portable if the compute ever moves clouds.

## When I'd revisit

If the state describes resources whose own provider you would necessarily be
recovering *through* anyway - so the independence buys nothing - same-cloud
storage can win on simplicity. A compliance boundary requiring data, state
included, to stay within one cloud or region would also override this. Short of
those, keep the failure domains apart: a few dollars of IAM setup beats
co-locating the recovery plan with the disaster.
