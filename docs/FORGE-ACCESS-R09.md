# Forge R09 — time-bound permissions and independent revocation receipts

Forge remains a **stateless contract adapter**, not a policy engine, timer,
principal registry, authorization provider, graph store, UI composer or agent.
Both actions accept **untrusted**, revision-bound host-supplied data and return
**non-executable intentions**. `ok: true` means structural validation only.

## `forge.access.lease.plan`

Request schema `forge.access.lease.request.v1`:
- `request_id`, `client_ref`, `principal_ref` and `renew_before_seconds` (0..86400).
- `snapshot`: `forge.access.lease.snapshot.v1` scoped to the same client and
  principal, `snapshot_ref`, `graph_revision`, `policy_revision`,
  `identity_revision`, `ui_revision`, canonical `observed_at` UTC ISO-8601.
- At most 256 unique capability grants: `capability_ref`, `lease_ref`, `decision`
  (`allow` or `deny`), `valid_from`, `valid_until`, `policy_revision`,
  `identity_revision`. A lease interval must be strictly increasing.
- At most 128 unique UI mounts with `mount_ref`, `function_ref`, `action_id`,
  nonempty unique `requires`, `status`, `verified`, `published`.

The recipe returns `revocation_candidates` for any inactive, unverified,
expired, not-yet-valid, denied or missing entitlement, including one missing
permission among several required by the same function. `retain_candidates`
are always `invokable:false`. `renewal_candidates` are *advisory*, not timers;
when time-to-expiry <= `renew_before_seconds`, a host can request revalidation.
At `observed_at === valid_until`, a lease is already expired.
An inactive or unverified UI mount triggers a **UI-only** invalidation plan;
it must not by itself revoke an otherwise valid runtime action.

**Clock provenance:** `observed_at` is merely a host claim; Forge NEVER reads
its own wall clock or proves freshness. The runtime must use its own trusted
monotonic/authoritative time source, validate bound principal identity,
policy revision and current entitlement **at the time of invocation**, not
only when projecting UI. Policy denies always take priority over expired or
nominally allowed grants. The client must not replay old snapshots as grants.

## `forge.access.revocation.assess`

Request schema `forge.access.revocation.request.v1` with `request_id`,
`operation_ref`, `event_ref`, scoped client/principal, current graph/policy/
identity/UI revisions and an explicit `targets` set of capability, action and
mount refs. At least one target is required.

Requires **six** independent, operation-bound external receipt *claims*:

1. `scope`: external reverse-dependency graph coverage with exact target sets
   and graph revision (`complete`).
2. `policy`: policy commit with exact capabilities and identity/policy revisions
   (`committed`).
3. `runtime`: independently enforced denial of **every** targeted action,
   using the same policy revision (`enforced`).
4. `ui`: UI CAS removal of **every** targeted mount at expected UI revision
   (`committed`).
5. `readback`: independent UI absence readback at that revision (`confirmed`).
6. `cursor`: durable revocation event acknowledgement bound to `event_ref`
   and policy revision (`committed`).

Each receipt must match **exact** `operation_ref`, `principal_ref`, and
`client_ref` — a different principal's evidence cannot justify action here.
Missing, duplicate, stale, partial or cross-scope evidence yields a specific
issue with an external-only corrective action. `evidence_consistent:true`
means input receipts agree *structurally*, **not** that revocation happened.
`access_revoked`, `authorized`, `authoritative`, `executed`, `ui_updated` and
`can_execute` remain `false` in every outcome.

## Host execution gate, not implemented by Forge

The independent host validates pinned provider identity, signatures, exact
permissions, trusted time and CAS revisions. It revokes runtime invocation
**before** changing visible UI, recomputes impacted reverse dependencies,
then verifies the external policy/runtime/UI/readback/cursor transaction.
Unknown remote write outcome requires durable readback/fencing; there is no
silent write failover, blind retry or automatic rollback. Offline clients
must invalidate cached executable actions; a local hidden button is not
proof of remote denial. The accepted state must be recomputed after reconnect.

## Availability

`Core + Forge` works with no optional peers. The named external ports in
`protocol-ports.json` are *proposed interface contracts*, not declarations
that those capabilities are installed or currently reachable. No actual
permission grant, revocation, remote call, session storage, UI mutation,
background subscription or agent exists inside the R09 adapter.

Run `node tests/forge-r09.test.mjs` plus all older `forge*.test.mjs` suites.
