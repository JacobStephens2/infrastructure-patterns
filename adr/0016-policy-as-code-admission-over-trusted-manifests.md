# ADR 0016 - Enforce cluster posture at admission over trusting reviewed manifests

**Status:** Accepted · in production (public artifact: `k3s-demo.stephens.page`, `github.com/JacobStephens2/k3s-demo`)

## Context

The k3s-demo manifests already follow a hardened posture: containers run
non-root, drop all Linux capabilities, mount a read-only root filesystem,
declare CPU/memory requests and limits, carry liveness and readiness probes, and
pin explicit image tags. All of it is visible in `k8s/deployment.yaml` and
`k8s/redis.yaml`, and code review is supposed to keep it there.

Review is necessary but it is not a control. It depends on a human noticing, on
every path into the cluster going through that human, and on nothing applying
YAML out of band. None of that holds under pressure: a copied example
reintroduces a root container, a hotfix drops the probe to "make it deploy," a
future agent with apply rights edits a limit it does not understand. The posture
is an *intention* written in a file, and an intention has no teeth when a
non-compliant object reaches the API server.

That matters more once automated changes enter. The whole reason to put an agent
near a cluster is to let it act without a human in the path for every change -
which is exactly when "we review for this" stops being true. The control has to
live where the change lands: admission.

## Decision

Enforce the posture as **policy-as-code at admission** - the API server rejects a
non-compliant workload before it runs - and treat the manifests' good behavior as
something to *verify*, not *trust*.

- **Primary engine: OPA/Gatekeeper (Rego).** Five `ConstraintTemplate`s encode
  the posture: require non-root, require cpu+memory requests *and* limits,
  disallow `:latest`/untagged images, require the hardening triad
  (no-privilege-escalation, read-only root, drop `ALL` caps), require liveness +
  readiness probes. Constraints are scoped to the workload's namespace
  (`match.namespaces`), so system namespaces are untouched; a real multi-tenant
  cluster would invert that to cluster-wide with system namespaces exempted.
- **A built-in `ValidatingAdmissionPolicy` (CEL) re-expresses one rule.** The
  no-`:latest` rule is also written as an in-tree ValidatingAdmissionPolicy, so
  the cluster *demonstrates* the engine tradeoff rather than asserting it. Rego is
  primary because the language transfers past Kubernetes - the same default-deny,
  reviewed-exception model gates an API or an agent's command surface, not only a
  pod spec - while the in-tree CEL path fits a rule that is simple,
  single-resource, and not worth a controller to run.
- **Fail-open on the webhook, deny on the rule.** Gatekeeper's validating webhook
  keeps its default `Ignore` failure policy, so a controller outage degrades to
  the prior "reviewed manifests" state instead of freezing all applies; the
  *rules* themselves deny. Cluster availability is not made hostage to the policy
  engine's.
- **The same rules are the proof.** Compliant workloads report
  `TOTAL-VIOLATIONS 0`; a deliberately non-compliant canary is rejected with a
  per-rule message; a normal `rollout restart` still passes the gate
  zero-downtime. The denial is the test.

## Consequences

- **The posture is now a guarantee, not a convention.** A regression - human or
  automated - is rejected at the source with a message naming the failing rule,
  instead of running until something notices.
- **Two engines, one decision documented.** Carrying both Gatekeeper and a VAP on
  this one rule is redundant by design: it makes the "which admission engine, and
  why" choice legible and reversible rather than a silent default.
- **A controller to run and keep current.** Gatekeeper is real added surface - a
  webhook, an audit loop, CRDs, a version to track. Accepted because the control
  it buys is exactly the one review cannot provide, and the fail-open webhook
  bounds the downside.
- **Policy can drift from intent if left unaudited.** A constraint scoped too
  narrowly, or an `enforcementAction: dryrun` left in place, looks like
  enforcement while enforcing nothing. The audit view (`kubectl get constraints`,
  violation counts) is the thing to watch, and silently-scoped exemptions get
  called out rather than left implicit.

## When I'd revisit

For a single-tenant cluster I fully control, with no automated apply path and a
hard CI gate that renders and policy-checks every manifest before merge, the
admission controller can be redundant with the pipeline - `conftest`/`gator` in
CI catches the same violations earlier and cheaper, and a small cluster may not
want a webhook in its critical path at all. The moment a second actor can apply -
a teammate, a CD system, an agent - admission is where the control has to be,
because it is the one place all of them share.

---

## Seventh-boundary appendix

*Every signature-system narrative and every ADR bridging to the new toolchain
(Terraform IaC, K8s/OPA-Gatekeeper, Prometheus/Grafana) carries this appendix. It
asks who is affected upstream and downstream of the automation, not only how it
behaves.*

- **(a) Upstream provenance.** The components are open-source infrastructure with
  public provenance: Kubernetes/k3s, OPA/Gatekeeper, and the Rego/CEL the policies
  are written in - no opaque model or hidden-labor dependency in this control path.
  Where this ADR's *authoring* used an AI assistant, that is disclosed here; the
  policies are human-readable and human-reviewed, and their effect is verifiable by
  reading the denial messages, not by trusting a vendor.

- **(b) Human-displacement assessment.** This displaces a *reviewer's vigilance
  task*, not a person's job: it removes "remember to check every manifest for root
  containers and missing limits," a low-value, error-prone burden. It moves toward
  *augmentation* - the engineer is freed from a checklist a machine enforces
  perfectly to reason about which policies should exist. The failure mode to guard
  against is the opposite of de-skilling: policy treated as an oracle no one
  understands. The mitigation is that each rule is a few lines of readable Rego with
  a plain-language glossary entry on the live page, so the team can still say *why* a
  thing is denied.

- **(c) Not delegated.** The policy engine may *reject*; it may never *grant*. It
  has no authority to approve an exception, widen its own scope, weaken a rule,
  deploy, or merge. Loosening a constraint, exempting a namespace, or switching a
  rule to `dryrun` is a human change to version-controlled policy under review -
  precisely the default-deny, named-human-gate model the boundary checklist
  requires. An agent operating against this cluster inherits the same gate: it
  cannot edit the policy that governs it.
