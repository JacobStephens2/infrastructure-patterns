# ADR 0013 - Staged declarative provisioning over a single imperative bootstrap script

**Status:** Accepted · in production

## Context

A new self-hosted service - a multi-service LLM research tool, several containers
behind a reverse proxy - needed a home on a single cloud VM. For one small box, the
path of least resistance is imperative: bring the VM up by hand, SSH in, and run a
`setup.sh` that installs the container runtime, sets the firewall, writes the
reverse-proxy vhost, and starts the app. It works on the first try and needs no extra
tooling.

It also leaves nothing behind. The box's real definition lives only in shell history
and the operator's memory; rebuilding it is archaeology, drift is invisible, and the
*why* of each choice is unrecorded. For a host that is itself meant to be a reference
for provisioning things properly, that is the wrong default.

The opposite over-correction is to do *everything* declaratively in one tool and one
run - provisioning, host configuration, and app deployment fused together. That couples
stages that change at very different rates and for very different reasons.

## Decision

Provision declaratively, and split the lifecycle into three stages with explicit
boundaries:

- **Provision the box and network with Terraform.** The VM, its firewall posture, and a
  stable address are resources in version-controlled config with checked-in
  provider/version pins. Infrastructure is reviewed and reproduced from code, not clicked.
- **Configure first boot with cloud-init**, rendered from a Terraform template. The
  container runtime, the reverse proxy, and a non-root deploy user are established once
  at creation. The seam is deliberate: Terraform owns *what exists*; cloud-init owns *how
  the fresh host is set up* - and can be swapped for a config-management play later
  without touching the provisioning layer.
- **Deploy the app as a separate step**, never folded into provisioning - see
  [0004](0004-shell-deploy-over-hosted-ci-runner.md). The app is released many times; the
  box is provisioned once.
- **Scope the provisioning credential to least privilege.** The provider token is
  *create-only* - it cannot delete or replace infrastructure. Rather than widen it, the
  module is shaped to never require destruction: `ignore_changes` on the image and
  user-data so editing first-boot config can't trigger a replace; edge resources (managed
  firewall, reserved IP) gated behind `count` flags and left off, with the live port
  posture enforced by the host firewall instead; resources found by name, since the token
  also can't manage tags.

## Consequences

- **The host is reproducible and reviewable.** Its definition is code - size, network
  rules, first-boot steps - all diffable and pinned, with the reasoning beside it. This
  is the IaC half of the same instinct [0011](0011-instrumented-metrics-stack-over-bespoke-prober.md)
  applies to observability: make the system legible from artifacts, not memory.
- **The stages change independently.** Editing the reverse-proxy config or the deploy
  doesn't touch provisioning; swapping the provisioning layer doesn't disturb the app.
  Each seam is crossable on its own.
- **A leaked provisioning token can't tear down the estate** - it can only create. That
  is the same least-privilege reflex as a scoped agent identity
  ([0005](0005-scoped-system-user-over-service-account.md)) and default-deny data access
  ([0009](0009-default-deny-host-pinned-db-access.md)), applied to the credential with the
  most destructive potential. The cost is real: I give up `terraform destroy`/replace and
  absorb it with `ignore_changes` plus live-over-SSH changes instead of rebuilds.
- **First-boot config is apply-once, not continuously enforced.** With image/user-data
  drift ignored, a change to cloud-init doesn't reconcile onto the running host; it lands
  on the next rebuild (or a deliberate taint under a broader token). Day-to-day host
  changes are made live and are not, today, themselves declaratively tracked - the known
  gap this split leaves open.
- **More moving parts than a script.** Terraform state, a provider lockfile, and a
  template to maintain, for one box. Justified only because the box is durable and meant
  to be exemplary; a throwaway host wouldn't earn it.
- **State is local for now.** Single operator, single host - local state is honest. It has
  to move to a remote backend (and stay out of any published slice) before more than one
  person, or one machine, touches it.

## When I'd revisit

If host configuration starts changing often enough that apply-once first-boot plus live
edits produces drift I can't see, I'd promote the configure stage to a real
config-management tool - an idempotent play run on a schedule - so the running host is
continuously reconciled, not just born correct. If the create-only limit ever blocks a
legitimate rebuild, I'd widen the token just enough to taint-and-replace, not to a
blanket admin credential, keeping the destructive surface as small as the workflow
allows. And the moment a second operator or machine is involved, local state moves to a
shared remote backend first.
