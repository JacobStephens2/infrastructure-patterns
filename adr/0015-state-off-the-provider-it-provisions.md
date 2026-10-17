# ADR 0015 - Keep Terraform state off the provider it provisions

**Status:** Accepted · in production (the remote state for traffic-serving DNS managed through Terraform)

**Companion code:** [terraform-cloudflare-dns](https://github.com/JacobStephens2/terraform-cloudflare-dns), a sanitized snapshot of the infrastructure-as-code repository as of June 2026, not a tracking mirror.

## Context

The state for live DNS belongs outside the provider whose records it manages.
Terraform uses that state to know which existing objects belong to the
configuration. Losing access to both the DNS provider and the state during one
account or provider failure would make recovery harder at the moment the
record of ownership matters most.

The production workload here is the DNS plane around a personal fleet of
applications and client sites. Existing records were imported, and changes go
through the normal plan and apply workflow. The separate compute rebuild
blueprint has not been applied to production and is not evidence for this
record.

Keeping the state beside the local checkout would avoid another service, but
it would leave durability and coordination to that one machine. Storing it on
a provider already involved in the fleet is convenient, but convenience is not
an independent failure domain.

## Decision

Store the production DNS state on AWS S3, separate from Cloudflare, whose DNS
resources it describes, and DigitalOcean, which hosts the applications.

- **Use the remote backend for the normal workflow.** The source configuration
  selects S3 for DNS state, and the recorded migration moved the existing
  state there. This is the running DNS workflow, not a proposed recovery
  exercise.
- **Use S3-native locking.** Conditional writes through `use_lockfile` avoid
  a separate lock-table service while preventing competing applies from
  treating the same state as exclusively theirs.
- **Scope credentials to the state bucket.** Supply them through the process
  environment, with the permissions needed to read, write, list, and manage
  the state objects. Credentials do not belong in the repository.
- **Version the bucket.** A bad state migration or apply can be investigated
  against prior state objects. Keeping an older object is recovery material,
  not permission to restore it without checking the live infrastructure.

## Consequences

- **Provider failures are separated.** A DNS-provider account failure does
  not also remove the state stored on AWS. A compute-provider failure does
  not remove it either. Recovery still depends on access to the destination
  provider and valid credentials; separate vendors do not make recovery
  automatic.
- **The local checkout is no longer the state's sole durable home.** A lost
  workstation does not erase the resource ownership record. Remote locking
  also gives another authorized operator a coordination mechanism rather
  than a convention to ask before applying.
- **A second vendor and credential need maintenance.** The smaller local
  setup was simpler. I accept the S3 backend, bucket policy, and credential
  lifecycle because the state supports infrastructure already serving users.
- **State is not an application backup.** It describes infrastructure
  ownership. It cannot restore application rows, files, or credentials lost
  with a host, and a successful state read is not a full restore rehearsal.

## Amendment - 2026-10-16

The earlier example described compute provisioning more broadly than its
production evidence supported. The verified live example is imported DNS
with state migrated to S3. The off-provider decision stands on that workload;
the unapplied compute blueprint is excluded from its production claim.

## When I'd revisit

If policy requires the state and resources to share a provider or region,
weigh that requirement against the coupled failure. Otherwise keep the state
outside the provider it governs. A backend change needs its own migration,
verification against the live resources, and recovery plan before the old
state location is retired.
