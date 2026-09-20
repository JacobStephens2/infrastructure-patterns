# ADR 0051 - A repeatable LLM judge over a more accurate one when the first verdict is cached as precedent

**Status:** Accepted · in production at small scale (a multiplayer word game played by a handful of people; the judge grades every attempt live)

## Context

A model grades each attempt in a game, live, inside a 2.5-second reveal beat.
The grade for a given pair of answers is cached, and the cache is the point:
players remember rulings, and a ruling that quietly differs from the one shown
last time is the self-contradiction they never forgive. So the first grade a
borderline pair ever receives becomes precedent.

A prototype benchmarked three candidates that fit the latency budget from the
production host.

- The fastest was also the noisiest: repeated grading of the same pair ranged
  by up to 35 points, with one 85-point swing in how it ordered two pairs.
- The second had similar latency and the repeatability of a much larger model,
  but graded the 40-to-75 band 10 to 15 points more generously than the
  fairest candidate.
- The third was the fairest, at a 2-second median that left almost none of the
  beat for anything else.

The instinct is to pick the most accurate model that fits. That instinct
assumes each grade is an independent sample. Here it is not.

## Decision

**Choose the repeatable model and calibrate it.** Consistency beats accuracy
when the cache freezes the first answer.

- A **constant offset is a calibration problem solved once**, against a
  labelled evaluation set of about 100 pairs. Noise cannot be calibrated away:
  it makes the first ruling on a borderline pair a dice roll, and then the
  cache makes the roll permanent.
- **Thresholds and score bands are set after calibration, not before**, since
  they are statements about the calibrated scale.
- **The grade the players saw is the precedent. No silent rewrites.** A
  stronger model's second opinion on a borderline pair is stored as an
  *annotation* that feeds rubric tuning offline. It never changes what the
  cache returns. The only thing that rewrites precedent is an explicit, visible
  overrule by the players.
- **Hedging is two identical requests to the fast tier**, taking the first
  back. It buys tail latency, and it is only safe because the model is
  repeatable: with a noisy judge, which request wins would change the grade.

## Consequences

- The same pair gets the same grade, which is the property the players
  experience as fairness. A slightly generous judge that is always the same is
  perceived as fair. An accurate one that wobbles is not.
- **Absolute accuracy is given up at the margin**, and the generosity in the
  middle band is corrected by calibration rather than by model choice.
- **The evaluation set becomes a maintained artifact.** A model version bump
  means re-running calibration before it serves traffic, because the offset is
  a property of the model, not of the rubric.
- Second opinions improve the rubric over time without ever contradicting a
  ruling someone has already seen.

## When I'd revisit

If verdicts stop being cached, or stop being visible as precedent, each grade
is an independent sample again and accuracy goes back to being the thing to
buy. If a candidate arrives that is both repeatable and fair inside the latency
budget, it wins, after the same benchmark. And if the label set grows large
enough to show the offset is not constant across the band, a single correction
is the wrong model and the rubric needs the work, not the judge.

The generalization is not about games. Any LLM-as-judge whose output is cached,
shown to a person, or compared against its own earlier output has this shape:
variance is the defect that compounds, and bias is the one you can subtract.
