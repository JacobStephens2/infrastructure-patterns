# ADR 0034 - A strict root allowlist returning 404 over a growing blocklist returning 403, for a legacy repository-as-webroot

**Status:** Accepted · in production (twenty-year-old PHP monolith whose repository root is the document root)

## Context

The legacy platform's repository root *is* the web server's document root.
Twenty years of development left package manifests, container configs,
backups, task runners, test scripts, and vendored dependencies inside the
webroot. Access control was a reactive `<FilesMatch>` blocklist answering
403 Forbidden.

Two failure modes, both structural. A blocklist fails **open** the day a new
tool, cache directory, or editor temp file appears. And 403 **confirms** to a
scanner that its probe found a real file - a map of internal structure, handed
out one status code at a time.

The modern fix - move the document root to a `public/` subdirectory - is a
multi-quarter refactor across procedural includes and hardcoded relative links
in two large sub-applications.

## Decision

- **Allowlist the root.** Only the explicit public entrypoints (index, favicon,
  the vendor-facing pages, and the existing public redirect aliases) are
  served directly at the root. Any other file requested at the root returns
  **404**.
- **Shield internal directories at the perimeter** (archive, container
  config, task runners, caches, logs, tests, vendored modules) with 404.
- **Local denial guards as defense in depth.** Each shielded directory carries
  its own `.htaccess` issuing `RedirectMatch 404 ^`, so a bypassed root rule
  still meets a wall.
- **Uniform 404.** Legacy `Require all denied` for sensitive extensions and
  manifests is replaced with 404, so a non-public asset is indistinguishable
  from a nonexistent path.
- **The modern front controller keeps its public link.** The modern
  application is reached through one public symlink into its own `public/`
  directory and resolves through its own front controller; the allowlist does
  not touch that path.
- **A functional test enforces the allowlist and the shields in CI.**

## Alternatives considered

- **Keep extending the blocklist.** Rejected: an allowlist is the only shape
  that fails closed against files nobody anticipated.
- **Relocate the document root now.** The right long-term layout, and the
  allowlist establishes equivalent perimeter security immediately without
  breaking the legacy applications. The refactor can proceed behind it.
- **Keep 403 for blocked paths.** Rejected: it acknowledges the file exists.

## Consequences

- **A new loose file at the root is inaccessible over HTTP by default.** A new
  public entrypoint must be added to the allowlist explicitly and covered by
  the functional test - which makes "why is this public?" a reviewable diff.
- **Internal tooling cannot be inspected or executed over HTTP**, including
  the container configuration and the vendored dependency tree.
- **Related, same repo:** the audit trail for settings changes now records who
  changed a secret-bearing field and when, but redacts old and new values and
  omits the field from restorable snapshots, migrating existing history even
  though that makes old values unrecoverable. An audit trail is not a
  credential store; retaining credentials there expands both their lifetime
  and their audience.

## When I'd revisit

When the document root moves to `public/`, most of this becomes redundant and
the allowlist shrinks to the front controller. Keep the 404 discipline and
the functional test through the move - they are the regression guard for the
refactor itself.
