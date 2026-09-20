# ADR 0038 - The guardrail reads every tree that runs unattended, and unknown is never green

**Status:** Accepted · in production (read and journaled at the start of every cycle of the unattended loop)

## Context

The unattended loop runs code with nobody watching
([ADR 0023](0023-attendedness-is-a-fourth-trust-axis.md)). The guardrail is the
check that the code it runs is code a human reviewed: it reads the forge's
branch-protection rules over the ref the deployed paths come from, and verifies
the deployed working tree matches that ref with no unreviewed modifications.
The result is a status chip on the loop's page.

It was configured for one repository and one ref. That was correct while the
loop's code lived in one place. It stopped being correct when the loop became a
reusable product with each instance keeping its own configuration repository
beside it. What executes unattended then spans two trees, and a guardrail
watching only the product tree shows a reassuring green over an unreviewed
commit in the instance tree.

A second problem surfaced at the same time. The guardrail reading had moved to
just before each dispatch. When the queue was empty there was no dispatch, so
no reading was journaled, and a healthy idle loop waking every thirty minutes
let its last reading age past the ninety-minute freshness threshold. The chip
reported silence when nothing was wrong.

## Decision

- **Declare every tree that runs unattended.** The instance lists each
  `{repo, ref, tree, paths}`. With nothing declared, the single-tree settings
  still work, so existing instances need no migration.
- **All trees green, or the chip is not green.** Every declared tree is
  evaluated each cycle. The overall reading is protected only if every tree
  passes every required rule (no deletion, no non-fast-forward, pull request
  required) and has zero unreviewed paths.
- **Unknown is never green.** If the probe fails or cannot answer for a tree,
  that tree is recorded as not protected with the error attached. It never
  defaults, and it never passes through.
- **The chip names the failing tree and rule**, such as
  `acme/config: main is missing pull_request`. When green, it lists each
  tree's repository, ref, and head commit.
- **Read once per cycle, before the dispatch loop.** Idle cycles journal a
  reading too, so silence on the chip means the cycle stopped running, which is
  the only thing silence should mean.

## Consequences

- An unreviewed edit or a dropped protection rule on any declared tree turns
  the chip red on the next cycle, within thirty minutes.
- False stale alarms on an idle queue are gone, which matters more than it
  sounds: a status light that cries wolf trains its reader to ignore it.
- The declaration is one more thing to keep true. A tree that runs unattended
  and is not declared is invisible to the guardrail by construction. The
  guardrail can prove the trees it was told about; it cannot discover ones it
  was not.

## When I'd revisit

If the set of unattended trees starts changing often, a hand-maintained list
is the wrong source and it should be derived from what the service units
actually execute. If a forge cannot express one of the required rules, that
tree stays red until the rule has an equivalent - I would rather explain a red
chip than define green down.
