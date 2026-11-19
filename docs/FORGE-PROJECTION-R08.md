# Forge R08 — personal UI projection and reconnect recipes

The Forge MAS plugin remains an **adapter**. It has no canonical graph, memory,
principal database, entitlement engine, UI renderer, event cursor, subscriptions,
identity-provider keys, or agents. These APIs inspect user-supplied *external*
state and return **non-executable candidate recipes**.

## One global graph, several independent projections

`Graph Manager` owns typed graph topology and reverse indexes. The capability
runtime owns function discovery and live authorization. An external UI Graph
owns visible contributions and the stream cursor. The identity/policy provider
owns principal scope and security revisions. Forge owns none of these.

```
External Graph + Capability + Identity/Policy
           | host-attested scoped snapshot (external future integration)
           v
  forge.projection.plan (stateless structural proposal)
           | candidate mounts + external authorization/staging intents
           v
  Host authorization -> UI Graph CAS -> UI readback (NOT done by Forge)
```

## API: `forge.projection.plan`

Input `forge.projection.request.v1` includes request/client/principal opaque refs,
plus `forge.projection.snapshot.v1` with independent graph/policy/capability/UI/
identity revision labels, `snapshot_ref`, grants (allow/deny), revoked capability
refs and UI contributions. Each contribution names one atomic function and action,
requires at least one capability, and provides active/verified/published claims.
Multiple UI mounts may refer to the same function. No user secrets or tokens.

For candidate visibility, all required capabilities must be explicitly allowed,
none revoked, and the contribution must be active, verified and published **in
the externally supplied snapshot**. Explicit deny, missing grant, revoked or
unverified state wins; withheld mount names are not echoed in the result.
Duplicate grants, duplicate mounts, inconsistent grant policy revisions and
malformed entries reject the entire request with cause and suggested remedy.

Even the resulting `candidate_visible` entries are **not** permitted actions:
`invokable=false`, `authorized=false`, `authoritative=false`,
`projection_applied=false`, `ui_updated=false`. This is structural filtering,
not proof of entitlement. A real host MUST authenticate/pin every provider,
verify the principal and live policy, resolve exact capabilities, use revisioned
CAS and read back the resulting projection before enabling any action.

## API: `forge.projection.reconnect`

Input `forge.projection.reconnect.request.v1` has request/client/principal,
`last` and `current` external cursor envelopes and an optional bounded, ordered
batch of external events. Cursors carry stream, sequence and graph, policy,
identity, UI revision labels. Event receipts are untrusted evidence references.

Output mode is one of:

- `replay_candidate`: contiguous sequence and graph chain, stable policy and
  identity, no security event. External host must independently verify replay.
- `reauthorize_and_readback`: no gap, no events, identical stream revision;
  still requires live host identity and UI readback.
- `full_resnapshot_required`: policy/identity rotation, event gap, reversed
  cursor, broken revision chain, repeated/missing receipts, or security events.

All modes set `invalidate_cached_actions=true` and `reconnected=false`.
Returned operations are not executed. External UI Graph discards stale actions,
rechecks grants, selects verified replay or full snapshot, commits revision CAS,
reads back active mounts and only then acknowledges the cursor. If a write
result is ambiguous, inspect the external transaction journal; never retry
blindly or move the write to an unverified standby.

## Failure policy — no unexplained blockers

Every validation failure or resnapshot condition includes a code, cause,
evidence path, impact and remedy. Withheld mount identities are not disclosed
in normal projection output. The remedy is an external action requiring live
authorization and independent evidence, not an automatic unsafe fix.

## Acceptance gates

1. Core + Forge alone passes MAS manifest/graph/HTTP checks.
2. No rights yields no proposed actions; explicit deny and revocation win.
3. An unverified/disabled function never becomes a candidate visible action.
4. Same function may have multiple unique UI mounts with one capability.
5. All reconnect paths invalidate cached actions and preserve external cursor.
6. Policy/identity epoch changes and replay gaps force a full resnapshot.
7. All return flags deny execution/authority; runtime must independently check.
8. No hardcoded node/URL/agent/provider or internal persistent registry.

Test locally with `node tests/forge-r08.test.mjs` in the full repository.
`tools/check-size.py`, `tools/architecture-check.py` and CI should also pass.
