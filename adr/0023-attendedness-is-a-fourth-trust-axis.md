# ADR 0023 - Attendedness is a fourth trust axis: keep a per-iteration microVM boundary for unattended agents, even at single-operator scale

**Status:** Accepted · in production (an unattended coding loop dispatching every thirty minutes; two vendors' CLI agents run under the same boundary)

## Context

The usual argument for stripping isolation at single-operator scale decomposes
safety into three axes - **blast radius, reversibility, trust model** - and
notes that all three collapse when one person authors every input and reviews
every output. Put the API key in the environment, run the agent directly, and
save yourself the sandbox stack. That reasoning is correct for an operator
sitting at the terminal.

Designing an *unattended* loop - an agent that picks up a ticket, works for
thirty to forty-five minutes, commits, and opens a draft pull request while
nobody is watching - showed that the blast-radius collapse rests on an
unstated premise: *"I notice and fix."* An unattended run is defined by nobody
noticing for the length of the run. The premise fails, so the collapse does not
follow.

The same design had to say what an unattended run may execute *on*. The
orchestration host that schedules runs holds wide production reach (vault
tokens, database passwords, fleet SSH keys). Model output executing on that
host turns an isolation bug into a fleet compromise.

## Decision

Treat **Attendedness** as a fourth trust axis, and the only one that does not
collapse for a single operator. It re-earns **exactly one subsystem** - the
Execution Boundary - and nothing else:

- **Every unattended iteration runs inside a fresh microVM** with its own
  kernel, a read-only mount of the loop's scripts, a workspace mount, and a
  deny-by-default egress allowlist (the code host and the model vendor's
  endpoints, nothing more). The microVM is destroyed after each iteration, so
  nothing an agent writes outside the workspace outlives one iteration.
- **Nothing crosses the boundary outward except the workspace.** Push and
  pull-request creation happen on the host, after every agent process is gone,
  with a credential the iteration never held (see
  [ADR 0024](0024-asserted-credential-inventory-is-the-isolation-seam.md)).
  "Proposal-only output" is a property of what is *inside* the boundary, not of
  what the prompt asked for.
- **Unreviewed code is not the same thing as unattended execution.** An
  *Attended Preview* - an operator starting a second instance to look at an
  unmerged branch - is allowed to run on the orchestration host, because the
  operator started it, is looking at it, and its failure mode is a page
  rendering wrong. The preview runs under a dedicated runtime identity with a
  staging database grant and no production grant, carries a visible banner
  naming its branch and SHA, holds a single lease, and is killed by a systemd
  `RuntimeMaxSec` so it cannot quietly become unattended. It may render; it may
  not dispatch.
- **The rest of the heavyweight factory stays deleted.** No federated
  short-TTL bearer tokens, no tmpfs capability drives, no result-grepping for
  taint markers, no content-trust floor. The three-axis collapse remains
  correct on every other point; this is a correction to one premise, not a
  reversal.

## Alternatives considered

- **Run the agent directly on the scheduling host with the key in the
  environment.** Correct for attended use, and exactly the configuration an
  unattended run makes dangerous. Rejected on the premise failure above.
- **Rebuild the full multi-tenant agent factory for one operator.** Every other
  control in that factory defends against hostile *input* from other tenants.
  A solo operator authors his own inputs; what he needs defending against is an
  *unsupervised* agent, which is a different threat that had been conflated
  with it.
- **Containers instead of microVMs.** Cheaper, but the unattended case is where
  a kernel-shared boundary is weakest: nobody is watching for the escape. The
  microVM sandbox tool was already installed; a separate kernel per iteration
  was the incremental cost.

## Consequences

- **The boundary is worth paying for even though the operator writes every
  prompt.** It is not defending against hostile input. It is defending against
  an agent nobody is looking at, and that threat is present in every unattended
  design regardless of scale.
- **"Attended" is a property you can lose by accident.** A preview left running
  overnight is unattended. Hence the lease, the banner, and the runtime cap -
  the banner alone fails (nobody is looking), the timer alone fails (silent
  stop looks like a crash). Both, or neither.
- **The boundary needs an identity to start.** The microVM tool requires a
  container-registry login to pull its guest image, which is the one credential
  the boundary itself costs. It is read-only and revokes independently
  (ADR 0024).
- **The orchestration host may never run an unattended loop on itself.** Today
  that holds because the loop's work source is a different repository's tracker.
  Pointing the loop at the orchestration repo's own queue would silently
  violate it, which is why it is written down rather than assumed.

## When I'd revisit

If the scheduling host ever passes the same credential-cleanliness assertion
the dedicated box passes, the physical separation buys nothing and single-host
operation is fine (ADR 0024 says exactly when). If a second operator or a
third-party work source arrives, hostile input is back on the table and the
deleted factory controls come back one at a time, each on its own evidence.
