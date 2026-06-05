# ADR 0010 - A pixel-equality gate over diff review for changes to generated markup

**Status:** Accepted · in production

## Context

Sometimes you have to change a frozen, machine-generated front end - a
static-site-generator export whose source is long gone - that ships as hundreds
of kilobytes of inlined, normalized markup per page. It's full of sharp edges:
non-breaking-space *entities* vs literal characters, en-spaces vs regular
spaces, attribute casing the browser silently rewrites, indentation and
whitespace that have drifted per page.

The default safety mechanism for any code change is reading the diff in review.
Here that gives false confidence in *both* directions: a textual change that
looks alarming (entity vs character) usually renders identically, while a change
that looks inert can shift layout. You can't meaningfully *read* this markup -
so you can't certify a change by reading its diff. The problem sharpens when an
automated agent is generating the edits at volume.

## Decision

Gate promotion on **rendered-output equality**, not on reading the diff.

- Build the change on a branch served from an isolated **staging mirror** -
  separate host, `noindex`, its own config; production is never touched until
  promotion.
- Render every affected page on staging and on production at fixed viewports and
  compare with an **absolute-error pixel metric**. Target: `AE 0`.
- A non-zero result is a finding to **explain** - then accept or fix - never a
  number to wave through. Treat textual/byte diffs as *advisory*; the pixels are
  the contract.
- Only after the visual diff is clean does a human approve. Promotion is a
  fast-forward merge; rollback is a revert.

## Consequences

- You can refactor markup you can't audit by eye - extracting duplicated chrome
  into shared partials, normalizing drift - with **proof** nothing visible moved.
- It separates real findings from false alarms: a pre-existing per-page
  inconsistency surfaced as a real ~1px shift (worth a human call), while an
  entity-vs-character diff and a webfont-load race both resolved to `AE 0` and
  were correctly ignored.
- It's the natural gate for **agent-generated** edits: the human reviews
  *evidence* (a clean visual diff) instead of trying to read machine output.
- **Costs:** a one-time staging mirror + render/diff harness (≈ an hour per
  site); and the gate proves only **visual** equality. It says nothing about
  semantics - a dropped `aria-current`, a broken link, changed JS behavior - so
  those still need their own checks. Pixels are necessary, not sufficient.

## When I'd revisit

Markup you actually own and can read (plain diff review is fine and cheaper);
highly dynamic or personalized pages where "the same render" isn't well-defined;
or changes whose whole point *is* visual, where a human comparing
intentionally-different screenshots is the right reviewer.
