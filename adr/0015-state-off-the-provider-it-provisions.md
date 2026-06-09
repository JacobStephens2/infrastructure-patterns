# ADR 0015 - Keep Terraform state off the provider it provisions

**Status:** Accepted · in production

## Context

Terraform records what it manages in a state file, and that file has to live
somewhere durable and lockable. The compute it describes - a droplet, a block
volume, the DNS in front of them - runs on one cloud provider. That provider also
sells an S3-compatible object store, so the path of least resistance is to put the
state in a bucket on the same account: one vendor, one set of credentials, one bill.

The convenience hides a coupling. State is most valuable exactly when something has
gone wrong and you need to rebuild - and the most total "something wrong" is losing
the provider itself: a region outage, a billing lock, a suspended account. If the
state lives on that same provider, the one event takes out both the infrastructure
*and* the record of how to recreate it. You are left rebuilding from memory at the
worst possible moment.

This is the same instinct as not storing the only backup on the machine being
backed up. Recovery state should not share a failure domain with the thing it
recovers.

## Decision

Put the state on a *different* provider than the compute it describes.

- **State lives in AWS S3; the compute lives on DigitalOcean.** A DigitalOcean
  outage or account lock leaves the state fully reachable on AWS, so a rebuild can
  proceed. The two now fail independently.
- **Locking is S3-native** (`use_lockfile`, conditional writes), so there is no
  second piece of infrastructure - no DynamoDB table - to stand up and keep alive
  just to serialize applies.
- **Credentials are least-privilege and scoped to the one bucket** (an IAM policy
  with `ListBucket` + `Get/Put/DeleteObject` on that bucket only), injected from
  the environment, never committed.
- **The bucket is versioned**, so a botched `migrate-state` or a bad apply can be
  rolled back to a prior state object.

## Consequences

- **A single-provider failure no longer destroys the means of recovery.** The
  reason for the whole exercise, bought cheaply.
- **State is effectively free and the locking is simpler.** A state file is
  kilobytes; on S3 that is a rounding error rather than an object-store's monthly
  floor, and `use_lockfile` removes the DynamoDB table the S3 backend used to need.
- **A second vendor and a second credential to manage.** Real added surface: an AWS
  account, an IAM user, a key in CI. Accepted as the price of independence - the key
  is read/write to exactly one bucket and nothing else.
- **The choice generalizes past disaster recovery.** Off-provider state is also what
  lets CI run `plan` without trusting the compute provider's account, and keeps the
  state portable if the compute ever moves clouds.

## When I'd revisit

If the state describes resources whose own provider you would necessarily be
recovering *through* anyway - so the independence buys nothing - the simplicity of
same-cloud storage can win. A compliance boundary that requires data, including
state, to stay within one cloud or region would also override this. Short of those,
the failure domains should be kept apart, and a few dollars of IAM setup is a small
price for not co-locating the recovery plan with the disaster.
