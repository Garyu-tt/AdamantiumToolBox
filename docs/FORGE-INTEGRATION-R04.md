# Forge R04 — Host dispatch intent and visibility receipt protocol

R04 is a **contract adapter**, not a coordinator or runtime. It does not own a graph,
source of truth, memory, queue, event subscriber, provider client, signing keys,
application implementation, UI state or agents. `Core + forge` still starts alone.

## `forge.integration.prepare`

Input: `forge.integration.request.v1` with `flow` (`publication` or `reconciliation`),
R02 `input`, external R03 `snapshot` and, for reconciliation, external `request_id`.
Publication requires a stable request ID and explicit expected graph revision.
It independently reruns R03 negotiation, rejects absent or ambiguous providers,
expired observations, policy denial, unpinned identity *claims* and incompatible
contracts, and emits a bounded sequence of `forge.host.dispatch.intent.v1` items.

Each item binds one request step to one *candidate* node/action/port; it carries:
- request ID, stable per-step idempotency key, exact action ID and candidate node;
- expected graph revision, discovery revision, policy revision and expiry;
- sequential predecessor receipt reference, access mode, host verification gates;
- `caller_authorized:false`, `executed:false`, no secrets or provider credentials.

An authorized host **must not execute merely because this object exists**.
It must rediscover that exact action on a pinned authorized node; compare live
policy and revision, authorize the caller and specific action, attach actual
payloads under provider contract, and persist idempotency/receipts externally.
If a write outcome is ambiguous it must read back by idempotency key; never
blindly retry or fail over to a different primary.

No fixed provider addresses, plugins, node identifiers or transport are embedded.

## `forge.visibility.assess`

Input `forge.visibility.assessment.request.v1` contains a publish/revoke mode,
function/request/expected revision and externally supplied host, transaction,
capability and UI readbacks. Publish additionally requires an execution receipt,
**independent** acceptance verification and a matching committed transaction.
Revocation requires a cause, committed revocation, disabled capability and hidden
UI contribution where one exists. A function explicitly declared headless with
`ui_exposed:false` must not synthesize a UI action, and can omit the UI receipt. All readbacks must agree on committed revision, action and
policy. The host readback window is at most 5 minutes and must be unexpired.

Output is *only structural consistency* with explained faults and exact remedies.
It is never a cryptographic signature verification, proof of genuine host
permission or proof of active UI. Flags `authoritative`, `authorized`,
`provider_bound`, `can_execute`, `executed` and `ui_visible` remain `false`
**even when all supplied receipts match**. There is deliberately no
`forge.visibility.activate` action and no background polling.

## Real integration requirements (outside Forge)

1. Authenticated MAS host discovery with pinned Mesh identity and exact grants.
2. External owner of idempotency, invocation transport and per-step receipt store.
3. External independent acceptance verifier, provenance and graph/capability
   transaction owner with CAS and durable commit/readback.
4. UI Graph consumes authoritative committed capabilities and permissions,
   then adds, updates or removes controls without page reload; Raw UI fallback.
5. Event cursor, replay and rollback remain external and revision-bound.
6. On any discrepancy, deny the action/UI pending authoritative readback and
   emit a cause/evidence/impact/remedies incident via external diagnostics.

The runtime, graph, task scheduler and UI remain distinct recursively installable
MAS plugins. Forge is usable without any of them. No agent is required in R04.
