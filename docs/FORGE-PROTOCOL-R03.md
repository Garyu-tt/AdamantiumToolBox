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

See [R03 event projection and deployment gates](FORGE-EVENTS-R03.md).
