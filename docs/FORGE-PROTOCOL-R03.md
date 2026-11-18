# ADR-FORGE-003 — Dynamic provider negotiation and event projection

Status: **R03 implemented (stateless planning); live provider access not implemented**.

## Why Forge is intentionally small

The Mechanicus platform may grow into one large, recursively composed **graph of facts and capabilities**:

```
project -> plugin -> module -> function -> capability -> UI contribution
                          |              |
                          v              v
                        request -> execution -> test -> publication
                          ^                      |
                          |                      v
                    revisit/lease <- incident <- changed dependency
```

This is not a second Forge graph. Graph Manager (or another compatible graph service) owns the canonical graph, reverse indexes, revision history and relationships. TaskPool owns requests, scheduling and work leases. Runtime owns the real capabilities, host policy and invocation; UI Graph owns contributions and live projection; diagnostics/remediation, audit and durable storage are independent providers. No agents are required by Forge. Each independently invokable function node represents one atomic development request; a task batch can contain many of these, with later revision-bound revisits.

**Forge owns no nodes, graph indexes, queues, memories, event offsets, agents, runtime dispatch, renderer or provider registry.** It exports schemas, validates structure and produces external plans. `forge.describe` exposes the contract. When no providers are installed, Forge still runs and returns useful validation and diagnostics without deceptive working UI buttons.

## `forge.providers.negotiate`

Input:

```json
{
  "flow":"publication",
  "input":{"function":"<forge.function.v1 object>","request_id":"request-unique-1"},
  "snapshot":{
    "schema":"forge.provider.snapshot.v1",
    "revision":"graph-r42",
    "policy_revision":"policy-r7",
    "source":"trusted-runtime-name",
    "observed_at":"2026-11-19T12:00:00Z",
    "expires_at":"2026-11-19T12:00:30Z",
    "capabilities":[{
      "provider_ref":"opaque-provider-ref",
      "node_ref":"opaque-logical-node-ref",
      "action_id":"runtime.invoke",
      "contract":"capability.invoke",
      "contract_version":"1.0.0",
      "status":"reachable",
      "can_invoke":true,
      "identity_pinned":true,
      "policy_allowed":true,
      "primary":true,
      "access":["write"]
    }]
  }
}
```

`flow` is `publication` (R02 `planPublication`) or `reconciliation` (R02 `prepareReconciliation`). The adapter **derives required ports from the chosen plan**. No user-supplied request may silently remove a required step. The capabilities list is bounded to 512 entries and a snapshot lifetime of at most five minutes. For each port, candidates must match the contract major version, reachable state, pinned identity *claim*, policy permission *claim* and required read/write access. A write requires exactly one declared primary candidate; ambiguity is an explicit incident rather than alphabetical fallover. A read with multiple candidates is likewise left for an explicit runtime selection. No addresses, fixed plugin IDs or host routing logic are embedded.

Outputs include `selections`, explained `issues`, `complete`, and a `preflight` description, **never permission to execute**. `provider_bound`, `authoritative`, `executed` and `can_execute` remain `false`, including in the successful match case. The input snapshot is a caller-provided *claim*; Forge **cannot authenticate its issuer or verify provider identities**. Runtime MUST independently verify source, pinned host identity, approval of exact action, current permission, graph/policy revision and freshness immediately before execution. Re-check every write, honor the primary host policy, and never retry an uncertain mutation on another host. A complete match is only advisory readiness.

Blocked/missing requirements return structured `code`, `reason`, `evidence`, `impact`, `remedies`. The adapter does not run remedies: the external diagnostics/remediation providers act under their own policy and create auditable attempts.

## `forge.events.project`

Input:

```json
{
  "schema":"forge.events.batch.v1",
  "stream_id":"external-stream",
  "cursor":{"stream_id":"external-stream","sequence":4,"revision":"revision-4"},
  "events":[{
    "schema":"forge.event.v1","id":"event-5","sequence":5,
    "type":"dependency.changed","function_ref":"demo.feature",
    "observed_revision":"revision-5"
  }]
}
```

This is a **pure reducer of an externally supplied, ordered batch** (1..256) and external cursor. The interface does not own a subscription or cursor. A gap, duplicate/replayed sequence, malformed type, missing publication commit or unexplained incident rejects the whole batch. No partial cursor advance is returned. A valid batch produces **intentions only**, plus `proposed_cursor`; the external coordinator must revalidate graph revision/authorization, apply the instructions and store the new cursor in its own atomic transaction. Forge never commits cursor or triggers UI changes by itself.

Recognized event categories:

- Dependency/provider/permission/contract/artifact/verification changes and `function.invalidated` generate external reverse-impact, invalidation, UI revoke, revisit and diagnostic steps.
- `function.verified` requests an independent publication receipt inspection; it cannot publish directly.
- `function.published` with `commit_ref`, or `ui.contribution.changed`, requests UI refresh with independent runtime readback.
- `incident.detected` requires explanation, evidence, impact and remedies from R02 `forge.incident.validate`.
- `incident.remediation_attempted` requires attempt/evidence references and independent acceptance verification before clearing a blocker.

UI Graph is the owner of displaying/removing live Raw UI commands. It should subscribe to the authoritative event source and use the publication coordinator's committed capability revision. Forge's event projections are advisory; supplying an event does not authenticate that event or bypass the host's policy.

## Service ABI and compatibility

The original MAS HTTP endpoints remain unchanged: `GET /health`, authenticated `GET /graph`, authenticated `POST /invoke`. R03 adds two action nodes with `forge.validate` permission: `forge.providers.negotiate`, `forge.events.project`. Manifest version moves to `0.3.0`, `forge.describe` schema to `mechanicus.forge.adapter.v3`. No Core modifications. The R01/R02 actions preserve their behavior.

## Blockers are actionable, never silent

Any invalid or unavailable provider requirement returns an explicit incident candidate. For missing capabilities: refresh host discovery, inspect approved pinned identity, check permission, and request a primary mapping if appropriate. An event gap requests missing-event replay; a stale snapshot requests re-discovery; a missing publication receipt requests authoritative readback. If external services cannot be reached, Forge reports the exact missing prerequisite, without generating synthetic evidence or attempting unauthorized repair. External, policy-bounded remediation can later attach attempts and results.

## Security and deployment gates

1. Verify MAS Core + Forge alone starts and validates its action graph.
2. Provider snapshot source must be authenticated by host **outside** Forge; do not treat arbitrary JSON booleans as proof.
3. Before provider writes: pinned logical-node identity, exact action permission and fresh revision; ambiguous POST requires readback, not blind retry/failover.
4. Publication coordinator must atomically bind capability and UI visibility; UI stays hidden until verified commit.
5. Event stream and cursor must be durably managed externally and applied transactionally. No direct Forge event listener.
6. No deployment/merge in this PR without the independent integration gates above.

## Next independent milestones

R04 (external integration): host-authenticated discovery adapter, real event delivery + revision-aware UI reconcile, integration tests with mock Graph Manager/TaskPool/UI Graph. These belong in independently installable providers or host adapters, not in Forge's own storage or scheduler.
