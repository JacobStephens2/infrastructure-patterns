# ADR 0064 - Authority over a shared record follows the person it is about, not the account that pays

**Status:** Accepted · in production (released to every account on 2026-10-11; availability verified, adoption unmeasured)

## Context

Paying to synchronize a personal record must not make somebody its owner.
Two people need to work with one sensitive record through separate accounts,
without sharing a password. Either may already hold its history, and either
may pay for the subscription that enables synchronization. The person the
record is about need not be either the current holder or the subscriber.

The convenient implementation would give authority to the account that sends
the invitation or supplies the paid entitlement. That would join billing,
existing possession, and ownership into one property because they happen to
start in the same place. Equal co-ownership would be another easy reading of
sharing: both can contribute, so both decide who keeps access.

Both models fail the case that matters. A person can pay for a record about
someone else and help maintain it without gaining the right to keep that
person from withdrawing access. Editing capability is not an equal claim to
control the record. That distinction has to survive handover, recovery,
departure, and account deletion, rather than exist only in the invitation's
wording.

## Decision

**The person the record is about owns it and grants another account access.
Billing never confers that authority.** The participants consent to the owner
identity during setup, even when the history starts in the other account.

- **Handover moves the authoritative identity, not another copy.** Preserve
  content, shared settings, retained recovery versions, and the existing
  third-party read link with its expiration. The former holder must not keep
  the donated history as a privately restorable server backup. Unrelated
  prior records remain private and inactive.
- **Membership belongs to accounts, not devices or login sessions.** A person
  can sign in on another supported device with their own credentials and open
  the same shared history. Ordinary sign-out ends that session; it does not
  transfer ownership or end the sharing arrangement.
- **Ending access takes effect at the server immediately.** Pending uploads
  from the departing account are refused, including when the owner's device
  is offline. Before further uploads, an authorized owner device refreshes
  the access keys and membership state. Existing local work survives that
  pause.
- **Revoke the third-party read link on departure too.** The departing person
  may know it. Removing their account membership while keeping that link
  would leave a separate access path alive. The owner issues a replacement
  deliberately instead of treating the old link as unrelated to departure.
- **Deletion follows the owner relationship.** Deleting the other account
  preserves the owner's record. Deleting the owner's account deletes the
  shared server history and ends the other person's access. There is no
  automatic succession to the remaining subscriber or contributor.
- **Historical restore restores content, never authority.** An older recovery
  version must not resurrect obsolete membership, former owner identity, or
  revoked access. Recovery state is not permission to reverse an access
  decision taken since that version was saved.

The [public release account](https://github.com/JacobStephens2/chart35-showcase)
dates availability to October 11, 2026. Release to all accounts establishes
availability; authorized pilot accounts do not establish observed adoption.

## Consequences

- **The paying participant can lose access to a record they help fund.** That
  is an accepted result of separating payment from authority. A subscription
  buys the product's synchronization capability, not somebody else's consent.
  [ADR 0049](0049-expand-contract-entitlements-old-endpoint-kept-reads-fail-open.md)
  separates provider status, entitlement, access, and presentation; this
  decision keeps record authority independent of those billing states too.
- **Deletion has a real cost for the other participant.** Contributions and
  payment do not grant an inheritance right when the owner deletes the
  account. The interface and notices have to explain that consequence before
  the action, rather than silently elect another owner afterwards.
- **Revocation is prospective.** Previously downloaded or exported copies
  cannot be recalled. The service can refuse future access and replace keys;
  it cannot make another person's earlier copy disappear.
- **Every lifecycle path carries both relationships.** Billing changes,
  support actions, restore, notices, and account deletion must ask separately
  who funds access and who controls the record. This is more work than one
  subscriber-owned row, accepted to make the authority rule hold outside the
  happy path. As in
  [ADR 0044](0044-additive-fail-closed-section-permissions.md),
  authority is explicit rather than inferred from a neighboring capability.
- **Verification has a boundary.** The release evidence exercises handover,
  independent accounts, departure, recovery, and invalidated read links in
  real-API browser workflows. It does not establish unrecorded native-device
  checks or observed adoption.

## When I'd revisit

A record about a group, a jointly owned asset, or an organization would need
another authority model. Personal ownership is justified here by one person
being the subject, not by sharing always requiring a single owner. Any later
transfer outside initial setup needs an explicit consent rule of its own;
changing the subscriber must never become an accidental transfer mechanism.
