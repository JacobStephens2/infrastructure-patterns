# ADR 0044 - Section permissions are additive on top of page permissions and fail closed

**Status:** Accepted · in production (the settings area of the operations platform staff work in daily)

## Context

A settings page grew sections that not everyone who can open the page should
see, let alone edit - financial settings beside cosmetic ones. The page already
had a view grant and an edit grant. The sections needed their own.

There are two ways to compose a page grant with a section grant, and they look
equivalent in the UI. **Alternative:** a section grant is another way in, so
holding it is enough to reach that section. **Additive:** a section grant
narrows what a page grant already allows, so both are required. The alternative
reading is the tempting one, because it makes each grant meaningful alone and
saves granting two things to one person.

## Decision

Section permissions are additive and fail closed.

- **Viewing a section requires the page view grant and the section view
  grant.**
- **Editing a section requires the page edit grant, the section edit grant, and
  the section view grant.**
- **A section grant never creates an alternative route to the page.** Held
  without the page grant, it reaches nothing.
- **The checks run on the server for every request**, not only when the UI
  decides what to render.

## Consequences

- **A hand-built request cannot mutate a section its author cannot view.** This
  is the property the design exists for. Hiding a form in the UI stops nobody
  who can post to the endpoint behind it.
- **An edit grant without a view grant cannot reach or save against the page.**
  There is no state in which someone can change a value they are not allowed
  to read, which also means every edit is made by someone who could see what
  they were replacing.
- **Granting is more verbose.** Giving someone one section means granting the
  page and the section. That is the cost, and it is paid once per person in an
  admin screen rather than once per incident.
- **The failure mode of a misconfiguration is "cannot see it"**, which
  generates a support request. Under the alternative reading it is "can see
  it", which generates nothing until it matters.

## When I'd revisit

If sections multiply until the grant matrix is unmanageable by hand, the fix is
roles that bundle page-plus-section grants, keeping the additive check
underneath. The composition rule does not change; only how grants are handed
out does.
