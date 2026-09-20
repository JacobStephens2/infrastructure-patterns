# ADR 0047 - On a generated status site, scripts hide rows and derive no figures

**Status:** Accepted · in production (an internal requirements-tracking site, regenerated from the repository, with a nightly run as its heartbeat)

## Context

A statically generated site answers one question for a project team: are we on
track? Every figure on it has exactly one definition. A shared roll-up rule
derives each verdict from the underlying ledger, the generator loads that rule
rather than restating it, templates render fields and compute nothing, and the
generator fails the run if a hand-recorded verdict disagrees with the derived
one.

Then the main page became a filterable browser: a tile grid of states, six
filter controls, three group-by axes. Filtering was the first interaction the
site had ever had that changes what is on screen, and the obvious
implementation of a tile grid above a filtered list is the wrong one - tiles
that follow the filter, recomputed in the browser.

The failure is specific. A reader filters to a subset, sees "Verified: 3" in a
tile, and quotes it. That 3 was computed by a script in their browser over
whatever their filter left standing. No run of the generator produced it, the
roll-up rule never saw it, and nothing on the site can be held to it. A figure
computed in a browser is a second definition of the rule, arrived at by the one
route none of the existing guards watch.

## Decision

A script may add and remove a hidden class, read and write filter state in the
URL, and open and close a disclosure. It may **not** derive a count, a level, a
verdict, or a percentage. Every figure the site model holds is rendered by the
generator and is literal text in the HTML before any script runs.

- **Tiles and meters are static totals over the whole set**, whatever is
  filtered. A reader who filters and screenshots a tile has screenshotted a
  figure the roll-up rule produced.
- **The size of the filtered view is stated separately, as "showing N of M".**
  It is a count of visible rows, not a figure of the model, which is why it may
  move under a filter and the tiles may not.
- **The freshness banner is the one thing a script writes**, because its inputs
  are the reader's clock and the last run's record, neither of which existed at
  generation time. It states no count and no verdict.
- **The rule is enforced as a property of the output, not by inspecting
  scripts.** A test walks every number the model holds and asserts each appears
  as literal text in a rendered page, with scripts, stylesheets, comments, and
  attributes stripped first. It was written before the filter bar, so a filter
  that derives a count fails on the day it is written.

## Consequences

- **A reader loses something real**: after filtering they cannot see that
  subset's state distribution without reading the rows. The alternative on
  offer was not the same figures scoped, but a second, unaudited answer to the
  question the tiles ask.
- **The pages are correct with scripting disabled and when read from an
  archive**, two conditions nobody checks by hand. A page whose tiles a script
  fills in is blank in both.
- **The enforcement is a floor, not a proof, and its limits are written down**,
  because a check nobody knows the limits of is read as covering more than it
  does. It reads the output, so it cannot see a script that *would* write a
  number. It asks the site rather than the page, so a figure moved off one page
  into a script passes while any other page still states the same value. And it
  can only look for a value, which makes it weak on single-digit fixtures and
  sharp on real data: all 1,213 figures the published model held were literal
  text across the five pages when this was adopted.
- **The "showing N of M" line is outside the check by construction.** Only M is
  a figure of the model.

## When I'd revisit

If the site gains a genuine client-side application - editing, not just
filtering - then scoped figures become legitimate, and the right move is to
ship the roll-up rule itself to the browser as the same code the generator
runs, tested against the same fixtures. One definition executed in two places
is fine. Two definitions is what this decision refuses.
