# ADR 0048 - Ship static musl release binaries with a CI guard, over glibc builds from whatever the runner has

**Status:** Accepted · shipped (the published Linux release assets of the open-source secrets launcher behind [ADR 0028](0028-per-consumer-secret-manifests-and-validate-every-manifest-read.md))

**Source:** [vaulted-agent](https://github.com/JacobStephens2/vaulted-agent), a public repository. The original record is ADR 0001 under its [`docs/adr/`](https://github.com/JacobStephens2/vaulted-agent/tree/main/docs/adr), beside the code it governs.

## Context

Release assets for a Rust CLI were built on the hosted CI provider's
latest-Ubuntu image. When that image moved to a release with glibc 2.39, the
published binary stopped loading on older distributions, failing with
`version GLIBC_2.39 not found`.

Nothing in the codebase calls anything from glibc 2.39. The dependency comes
from the Rust standard library's process-spawn path, which uses
`pidfd_spawnp` and `pidfd_getpid` when they exist *at build time*. Both are
weak symbols, but the version reference the linker records is not marked
`VER_FLG_WEAK`. The dynamic loader resolves version dependencies before it
looks up any symbol, so it rejects the image outright. There is no runtime
fallback and no way to satisfy it on the target: glibc is the distribution's
core C library, not something you upgrade under a supported install.

glibc is backward compatible and never forward compatible, so "build on new,
run on old" is broken by construction, and which libc the *build* machine had
is not a property anyone reviewing the repository would think to check. The
affected hosts were most stable server distributions in service: the RHEL 9
family and Amazon Linux 2023 (2.34), Ubuntu 22.04 (2.35), Debian 12 (2.36). It
was noticed when an install broke on a live host.

## Decision

Published Linux binaries target `*-unknown-linux-musl` and link statically.
The `*-unknown-linux-gnu` targets are not published.

- **The release workflow fails the build** if a Linux asset has an `INTERP`
  segment or any `GLIBC_` version reference. Without the guard this regresses
  invisibly: the binary runs fine on the runner that built it and on my
  machine.
- **The remote installer runs `<asset> version` before installing** and falls
  through to the next candidate, or to a source build, if the asset will not
  start. A bad asset fails at install time, not at first launch.

Two alternatives were rejected. Building the gnu target in an older container,
or with a cross toolchain pinned to an old glibc, works and keeps a
glibc-native artifact - but it only moves the floor. The artifact still has
one, and it silently tracks whatever base image CI happens to use. Publishing
both doubles the matrix and puts the trap back into the installer's selection
logic, for no benefit this binary can use.

## Consequences

- One Linux asset per architecture runs on every distribution in service, with
  no floor to track.
- **Static musl's real limitation is NSS.** `getpwnam` and `getgrnam` cannot
  load directory-service modules, so users from LDAP or SSSD do not resolve
  in-process. That is safe here only because this binary never does user or
  group lookup in-process: it shells out to `id` and to `sudo`, which are
  ordinary dynamically linked distribution binaries and resolve directory users
  normally.
- No extra toolchain step is needed; the compiler links these targets
  self-contained.

## When I'd revisit

**If in-process user or group lookup is ever added, this decision has to be
revisited before that ships** - it is the one change that silently breaks
directory-backed users.
