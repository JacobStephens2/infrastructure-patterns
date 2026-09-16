# ADR 0033 - Grow the monitoring host's own disk over attaching a block volume, and cap retention by size so the bigger disk is not just a later failure

**Status:** Accepted · in production (the monitoring host from [ADR 0022](0022-colocated-loki-behind-collector-seam-over-dedicated-log-stack.md))

## Context

The monitoring host from ADR 0011/0022 ran out of disk. The ordinary answer
is a block volume: attachable while running, resizable, detachable, and about
the cost of a coffee a month. This host had a wrinkle that is invisible from
its own page: it was created on an older disk allocation for its size, and
the same size's *current* catalog entry ships twice the disk at the same
price. A same-size resize with the disk flag set doubles the disk for nothing.
A future reader pricing "more disk" the ordinary way finds the volume and
concludes wrongly, which is why this is an ADR and not a ticket.

The resize was attempted against a root filesystem at 100% with twenty
kilobytes free. The provider documents the trap plainly - do not resize first
when there is no space left, because the filesystem table cannot update to
expose the new space - and the host came up unbootable, recoverable only
through the console's recovery ISO, which has no API. That extended an outage.

## Decision

- **Resize the host's own disk** rather than attach a volume. Accepted costs:
  a provider disk resize is one-way (grows, never shrinks), so the storage is
  now tied to this host's lifecycle in a way a detachable volume would not
  be, and the resize needs the host powered off, which a volume attach does
  not. Both judged cheaper than the volume's annual cost plus a migration of
  the metrics store onto a new mount.
- **Reclaiming space is a precondition of the resize, not preparation for
  it.** Order is load-bearing.
- **The bigger disk is not the guard against recurrence.** The metrics store
  gets a **size-based retention cap** alongside its existing time-based one -
  whichever triggers first wins - sized to leave headroom for the log store,
  compaction scratch, and system logs. A log-hygiene role bounds the logs that
  consumed the last of the headroom. Without both, a bigger disk only moves
  the same failure further out.

## Consequences

- **The size cap does not prejudge the time target.** Thirty days is still the
  stated retention; the cap is a floor on free space, revisited when retention
  policy is.
- **Disk is now a first-class alert on the monitoring host**, at a threshold
  well below full, because this is the box that would otherwise report its
  own outage last.
- **Contrast with [ADR 0032](0032-dedicated-host-for-unauthenticated-ingestion-store-private-by-construction.md)**,
  where a volume *was* chosen: that host's disk growth is the workload's whole
  storage story and the volume must outlive a rebuild. Here the disk holds a
  store that already self-prunes, and the grandfathered allocation made the
  resize free. Same question, opposite answers, both for reasons.

## When I'd revisit

If the host is ever replaced, the grandfathered allocation goes with it and
the volume becomes the default again. If retention needs cross what local
disk can hold, the answer is object storage per ADR 0022, not a third
resize.
