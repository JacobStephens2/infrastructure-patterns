# ADR 0065 - Assert enforcement at the script, the workflow, and the ruleset

**Status:** Accepted · in production (a shared planning repository used by a five-person project team; script and workflow checks live, required-check registration verified on 2026-10-16)

## Context

A green commit-message check did not mean commit messages were valid, and
making it red did not by itself make it a merge gate. The path from a
validator to a blocked merge crossed three independently fallible layers.
Each needed evidence of its own.

The first failure was in the Python wrapper around the commit-message tool.
It ran validation, captured the failure, and exited zero anyway. This was
not an accidental branch the tests had missed: a test explicitly asserted
success even when validation failed. The suite protected the wrong contract.

The workflow then appended `|| true` to the wrapper invocation. Fixing the
Python exit code alone would still have left the CI job green. After both
were fixed, a read of the live branch ruleset found the job absent from the
required checks. It could now fail honestly without preventing a merge.

The bot's comment said merge was blocked. The code change could not make
that true: registering a required check was an external repository setting,
separate from the script and workflow. The comment was changed to say the
check failed until the commits were fixed. Required-check registration
followed later.

This is the same family of failure as
[ADR 0028](0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md):
a passing validator can be a comforting signal about the wrong thing. Here
the validator could see the problem; its verdict was discarded on the way
to the decision it was supposed to control.

## Decision

Treat enforcement as a chain of observable effects. Verify the script's
failure, the workflow's propagation of that failure, and the platform's use
of the resulting check before describing it as a merge gate.

- **The script returns the tool's result.** The wrapper passes the validation
  result to its process exit. Tests assert failure for invalid input and
  success for valid input, including the thin CLI entry point. A test that
  preserves unconditional success is removed as part of the contract change.
- **Feedback is published before failure exits.** The script writes the
  structured result and explanatory output before returning. A test checks
  that order on the failure path. Otherwise the job could turn red while
  the feedback step sees no errors and says nothing useful to the author.
- **The workflow propagates the result.** The validation step invokes the
  script without a success-forcing shell suffix. Follow-on feedback can run
  after a validation failure without pretending validation passed. Its
  condition respects cancellation rather than blindly running after a
  cancelled job.
- **Workflow conventions are checked as workflow structure.** A test reads
  the YAML and rejects an unjustified `always()` in a job or step condition.
  Cleanup that really must survive cancellation needs its reason beside the
  condition. The test distinguishes an expression from the same text inside
  a string and reads an inherited condition from its defining mapping.
- **A required check is verified in the active ruleset.** The repository's
  script tests cannot prove an external setting. A live ruleset read now
  confirms that the commit-message job is required. That registration is a
  dated observation; the tests do not make the platform setting immutable.
- **The bot says only what the evidence establishes.** A failing check and a
  blocked merge are different claims. Feedback must not promise the second
  merely because the workflow can demonstrate the first.

Keeping commit-message lint advisory would have been a defensible policy.
It was rejected here because enforcement was intended, while the actual
behavior had become advisory by accident. Renaming the green job would not
have repaired that disagreement.

## Consequences

- **A gate needs more proof than its own passing tests.** The corrected tests
  exercise failure propagation, while workflow inspection and the live
  ruleset check establish the rest of the path. None alone certifies it.
- **The tests are coupled to CI structure.** Renaming or reorganizing jobs,
  changing wrapper boundaries, or introducing YAML indirection can require
  updating the checks. That maintenance buys a visible failure when the
  enforcement path changes.
- **Cancellation is part of the contract.** Posting useful feedback after a
  failed validation does not require continuing work after cancellation.
  Exceptional cleanup is still allowed, but it is an explicit exception.
- **A repository setting can drift independently of git.** The live read
  closes the proof for the current ruleset; a later platform change needs
  another check. A successful local test run cannot certify that future
  state.

The coverage rule spans the enforcement path: a correct script says nothing
about a workflow that suppresses it or a ruleset that does not require it.

## When I'd revisit

If maintaining required checks by hand becomes a recurring source of drift,
I would make the ruleset declaration and its verification part of the
repository's managed configuration. If the team deliberately makes a check
advisory, its workflow, tests, and contributor feedback should change
together. A policy change should not arrive as a green check that quietly
stopped enforcing anything.
