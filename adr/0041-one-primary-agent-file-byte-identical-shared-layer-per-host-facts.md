# ADR 0041 - One primary agent instruction file, a byte-identical shared layer, and per-host environment facts beside it

**Status:** Accepted · in production (every host in the fleet where a coding agent runs; migration finished 2026-08)

## Context

Four different agent harnesses run across the fleet. Only one of them reads its
vendor-specific instruction file; the other three read the vendor-neutral
`AGENTS.md` and nothing else.

Every host-specific warning lived in the vendor-specific file. So a session
started under a different harness on one staging-tier host was never told the
one fact that mattered most about that machine: its database connection is the
production one. Nothing in the setup stood between that session and a write
to production, and the gap was invisible from inside any single harness.

Looking at the files made it worse. The five web-host instruction files shared
93 byte-identical lines, while their supposedly generic 125-line middle had
drifted into five distinct versions.

## Decision

- **`AGENTS.md` is the single primary agent file everywhere.** The
  vendor-specific file becomes a symlink to it.
- **Per-environment facts live in a separate `ENVIRONMENT.md`**, reached by a
  one-line pointer from `AGENTS.md`. It states which database this environment
  touches and whether an agent may write to it, and little else.
- **The shared layer stays its own byte-identical file on every host**, and the
  sync tool gains a fleet-wide checksum check.
- **`ENVIRONMENT.md` is untracked and gitignored.** That is safe because the
  deploy script refuses only *tracked* dirtiness, so an untracked file never
  blocks a deploy.
- **State the command, not the answer.** Documentation that restates a current
  value is now treated as a defect.

Three alternatives were rejected. Renaming the vendor file per host collides
with an `AGENTS.md` the application repository already tracks, and overwriting
it dirties the worktree the deploy script checks. A per-host file with no
pointer leaves the harness gap open, because the pointer has to live in the
file the other harnesses already read. And rendering one composed file per host
hides drift: keeping the shared layer byte-identical is what makes drift one
`sha256sum` away from detection, and that is the only reason the shared/per-host
split can be trusted.

## Consequences

- **The harness gap closes for every current and future harness** that reads
  the neutral file, without my enumerating them.
- **A whole class of divergence goes away.** Host-specific content is no longer
  duplicated into files that were supposed to be generic.
- **Four stale claims surfaced while making the change**, all of them prose
  caching a fact the environment already knew. One described a database as
  read-only when its grants did not make it so. A paragraph that says "this is
  read-only" is not a control, and an agent will believe it.
- **Explanations that are properties of the code move to the repository that
  owns the code**, reached by pointer. Migration discipline lives once.
- **One line had to be added to a file another repository owns**, by pull
  request. That is the cost of putting the pointer where it will be read.

## When I'd revisit

If harnesses converge on a standard for layered or included instruction files,
the pointer becomes an include and the symlink goes away. If per-host facts grow
past a screen, they are turning back into documentation and should be replaced
with commands that print the truth.
