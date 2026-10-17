# ADR 0050 - One language-neutral conformance corpus over three hand-written engines, until a shared core can retire them

**Status:** Accepted · in production for the web engine (the same corpus runs against Kotlin and Swift watch engines; watch distribution remains unfinished)

## Context

The app's core is a rules engine: given a sequence of daily observations, it
assigns each date a classification. Users make real decisions from that output,
so two platforms disagreeing about the same observations is not a cosmetic
bug.

The engine exists three times, written by hand: TypeScript for the web app,
Kotlin for Android and Wear OS, Swift for Apple platforms and the watch. The
web implementation is the reference; the native apps each re-implement it in
their platform's own language.

A shared engine compiled to every target was attempted in June 2026 and set
aside. It did not become the production engine. The native work proceeded
without waiting for it, so three implementations remain an ongoing maintenance
cost. They will drift unless something stops them, and "careful review" is not
a thing that stops drift across three languages.

## Decision

One JSON file is the single, language-neutral source of truth for the engine's
behavior. Each case feeds a list of observations through the engine and asserts
the computed classification for every date.

- **Every implementation runs the same file in its own test suite**, under its
  own native runner. There is no translation layer and no generated test code.
- **Field names and codes match the reference data model exactly**, so the JSON
  decodes straight into each platform's own types. A renamed field breaks three
  suites at once, which is the point.
- **The corpus changes first.** Found a bug or changed a rule: add or amend a
  case, watch all three suites go red, then fix each engine until they pass.
- **A case that fails on one platform only is a real divergence**, and is
  treated as a bug in that engine rather than a quirk of its test.
- **Cases are complete.** The engine classifies every observed date, so a case
  must list the expected result for all of them. A case cannot pass by
  asserting only the dates it cares about.

## Consequences

- Three engines in three languages are held to identical output by something
  mechanical, and a rule change is one edit with three red suites as its to-do
  list.
- **Every rule change is still implemented three times.** The corpus prevents
  drift; it does not remove the duplication.
- **The corpus is only as good as its cases.** It proves the engines agree on
  what it contains and says nothing about inputs nobody wrote down. Three
  engines can agree and all be wrong.
- **The corpus outlived the attempted rewrite.** It keeps the separate engines
  accountable now. If a shared core is taken up again, the same file becomes
  its acceptance suite, judged by the behavior users already depend on rather
  than by a fresh reading of the rules.

## Amendment - 2026-10-16

The earlier version described the shared core as underway. That premise was
stale: the attempted core was set aside, while the corpus and three engines
remained. The Context and Consequences above now state that boundary; the
corpus is an ongoing control, not a temporary wait for a scheduled rewrite.

## When I'd revisit

I would reopen the shared-core choice if maintaining the three engines costs
more than another migration attempt. A replacement must pass the corpus on
every target before the engines retire; no rewrite is currently in flight.
If the engines ever need
to diverge on purpose - a platform that cannot show a particular result - that
difference belongs in the presentation layer, and the corpus keeps asserting
one answer.
