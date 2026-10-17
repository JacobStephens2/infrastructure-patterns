# ADR 0053 - A review finding carries a failing test, and a decline cites the run

**Status:** Accepted · in production in thirdshift, the open-source issue-to-pull-request factory that superseded Tracewake (used on my own repositories and the reservations platform's work tracker; evidence rules shipped in October 2026).

**Source:** [thirdshift](https://github.com/JacobStephens2/thirdshift), a public repository. The canonical rules live in its [review skill](https://github.com/JacobStephens2/thirdshift/blob/main/skills/thirdshift-code-review/SKILL.md) and [session prompts](https://github.com/JacobStephens2/thirdshift/tree/main/prompts). The motivating figures are in my [published replay study](https://stephens.page/blog/fresh-eyes-beat-a-second-family/paper/).

## Context

A reviewer finding a bug did not make the author fix it. In thirdshift's own
repository, the original reviews had raised two of six timing bugs that later
escaped. The authors declined both as decisions for someone else. Nobody made
those decisions before the pull requests merged.

The review pipeline had two axes. A standards reviewer checked the repository's
rules and code smells; a specification reviewer checked the requested
behavior. The authoring session received their reports, fixed the findings it
agreed with, and listed the rest in the pull request body. That last step
assumed a person would adjudicate the remaining disagreements.

The published study counted 1,152 declined findings across 199 merged pull
requests in thirdshift itself. Only 12 explicitly deferred a decision to a
human or a later issue. Listing a disagreement did not make it someone's work,
and an author's explanation was not evidence that the reviewer was wrong.

Adding a better reviewer would leave this path intact. A correct finding could
still be talked away. I needed a rule for how a finding is resolved, alongside
the choice of where another review might help in
[ADR 0052](0052-a-fresh-session-second-look-over-a-second-model-family.md).

## Decision

Every finding that says behavior is wrong carries a test or command, written
out in full by the reviewer, that fails if the finding is right. The author
runs it as written before deciding the finding.

- If it fails as predicted, fix the code and keep the test.
- If it passes, the author may decline the finding, citing that run. The run
  must exercise the finding; a green suite elsewhere is not a refutation.
- If the decision belongs to the specification owner or the human operator,
  file a tracked issue unless an open one already covers it. State the
  finding, evidence, originating pull request, and why the decision is not
  the author's to make. Link it from the declined finding.

A standards judgement is still a judgement. Cite the documented rule, or name
the code smell as a heuristic. A specification disagreement cites the
requirement. Do not invent an executable test for a preference that cannot
have one. Every skipped finding still needs the code, recorded decision, or
run that refutes it, or an issue for the person who must decide.

Each reviewer also lists the files it read. Compare those paths against the
changed-file list captured from the pinned diff. Send missing files back to
that reviewer in one follow-up, then declare any remaining gaps in the report
and pull request body. Keep each axis's reports beside the session log, even
when it reports no findings. A bounded follow-up makes omissions visible
without turning review into an unbounded retry loop.

## Consequences

- **A decline can be checked.** The review leaves a command and its result,
  rather than only two competing explanations. This closes the path where a
  real finding was raised and dismissed without testing it. It does not find
  a bug the reviewers never raise.
- **Tests can be inadequate.** A passing command licenses a decline only when
  it exercises the alleged behavior. The prompt states that condition; the
  system does not independently prove a reproduction's adequacy. An author
  and reviewer can still share the same mistaken premise.
- **Review costs more.** Runnable reproductions and files-read lists take
  output space, and a missing file can require another reviewer session. The
  prose allowance is 800 words per reviewer, with commands, tests, and
  files-read lists outside that limit.
- **An issue preserves a decision without making it.** Filing one gives a
  deferred call an owner-visible place. It does not itself block the current
  pull request or guarantee that someone will resolve it.
- **Coverage has a denominator.** The changed-file list is independent of the
  reviewer's account of its work. This is the same move as
  [ADR 0037](0037-completeness-check-derives-its-own-denominator.md): derive
  what should have been checked, then state what was left out.

## When I'd revisit

If retained tests show reviewers repeatedly supplying commands that pass
without exercising their findings, strengthen the reproduction check before
adding reviewers. If deferred issues accumulate without decisions, change the
human handoff or the blocking policy. Measure escaped defects after the rule;
shipping an evidence format is not proof that it improved review quality.
