# ADR 0052 - A fresh-session second look over a second model family

**Status:** Accepted · review policy in force in thirdshift, the open-source issue-to-pull-request factory that superseded Tracewake (used on my own repositories and the reservations platform's work tracker). The proposed opt-in second look after feature review is not implemented.

**Source:** [thirdshift](https://github.com/JacobStephens2/thirdshift), a public repository. The research note lives under its [`docs/research/`](https://github.com/JacobStephens2/thirdshift/tree/main/docs/research). Figures below come from my published paper, [Fresh Eyes Beat a Second Family](https://stephens.page/blog/fresh-eyes-beat-a-second-family/paper/).

## Context

A fresh same-model session matched or beat the other family's catches at
every checkpoint I tested. I had set out to buy independence through a different
family. The comparison usually offered for that choice changes two things at
once: the reviewer uses a different model, and it did not watch the code being
written. I needed to separate them before changing a running pipeline.

thirdshift builds an issue in an authoring session, asks reviewer subagents to
check standards and the specification, then lets the author address their
findings. A feature split into tickets also gets a review of the assembled
branch. Those are different places to add another reader. A result at one does
not justify adding latency to all of them.

I fixed pass/fail bars before writing the replay script, then replayed 183
historical reviews against repositories truncated at the reviewed commit.
Each session had no later history or remote, a signed-out GitHub CLI, and a
prompt forbidding edits, builds, tests, and network use. HEAD and working-tree
state were checked before and after; none changed its repository. Two later
follow-ups added 24 sessions and were reported as post-hoc.

The arms paired a reviewer from another family with a fresh session of the
same model. Inside a Run, the other family caught one of six escaped timing
bugs, and the fresh same-model arm caught that one too. In the reverse
direction, the other family caught none of three escaped bugs. Neither result
paid for a cross-family stage inside every Run.

After the whole-feature review, both arms passed: another family found real
missed bugs in 16 of 30 features, and a fresh same-model session in 19, against
a bar of six. Replacing the original feature review with the other family
failed its separate bar. Adding a reader after that review and replacing the
review are different decisions.

## Decision

Do not add a cross-family reviewer inside each Run. Use a fresh same-model
session as the control whenever I test that proposal again. Do not adopt the
timing checklist that tied the fresh arm's catch count while taking longer,
and do not replace the feature review with the other family.

The one proposed addition is an opt-in second look after the feature review,
with harness, model, and effort configurable. My current lean is a fresh
session on the feature run's own harness. That is a planned addition, not a
shipped review stage. The measured decision already in force is which extra
stages I have declined to add.

A pre-build plan check remains undecided. Its passing configurations depended
on the checker and effort setting; it did not establish a general advantage
for a second family.

## Consequences

- **Placement earns its cost separately.** The feature boundary exposed missed
  behavior in this sample. It does not follow that another reviewer belongs
  inside every ticket. [ADR 0036](0036-review-capacity-over-a-daily-spend-cap-for-unattended-dispatch.md)
  treats review capacity as scarce; review sessions spend capacity too.
- **The other family did buy precision.** In the feature replay, two of its
  25 findings were wrong, against nine of 40 from the fresh same-model arm.
  Choosing the same model accepts that noise; it does not make diversity
  worthless.
- **This is a local result.** Every grader was a Claude agent, with shuffled
  labels that could not hide report style. There was one session per cell,
  the fresh feature arm was added late, and the bug replay changed both the
  session and the review skill. The checkpoints also used different bars.
  Their pass rates cannot isolate why placement mattered.
- **The judge serves the pipeline.** As in
  [ADR 0051](0051-repeatable-llm-judge-over-accurate-one-when-the-verdict-is-cached.md),
  a model's headline rank is not the property I need. Here the question is
  what its extra review finds beyond a fresh-session control.

## When I'd revisit

After implementing the optional feature-level second look, count real fixes
over roughly ten production feature runs using the saved reviewer reports.
The replay cannot establish that live benefit. Re-run the comparison when the
review skill or model changes enough to invalidate the control, and keep the
bars fixed before seeing the result.
