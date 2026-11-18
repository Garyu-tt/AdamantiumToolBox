# Forge R05: recursive composite composition protocol

**Boundary:** Forge remains a stateless, CPU-first MAS contract adapter.
It is neither an engine nor a graph database nor a scheduler. No agents.

## What a composite means

A composite is a named, non-executable `group` containing nested groups and *references*
to executable `forge.function.v1` nodes. Function identity and runtime handler are unique
in the catalog, even if the same function is displayed under multiple groups. Any function
has at most one independently invokable capability action. Grouping is not execution.

This gives three synchronized projections over an **externally owned** graph:

- Containment tree/DAG: group → child group or existing function reference.
- Execution dependency graph: function → required capability (may be external).
- UI graph: group and function contribution drafts; all initially unverified.

The reverse index is a pure preview derived from returned edges, not a local database.
Each execution work intent is one function per independently identifiable request. Such
intents must be given to TaskPool (or another authorized scheduler), not run in Forge.

## `forge.composite.plan`

Input: `{schema:'forge.composite.request.v1', request_id, expected_revision?,
functions:[forge.function.v1,...], root:{kind:'group',id,version,label,children:[...]}}`.
A child is `{kind:'function',ref:'...id...'}` or another group object.

Output: `{schema:'forge.composite.plan.v1', graph_intent, work_items, ui_drafts,
external_dependencies, topology, ...false flags}`.

Validation gates:

1. All local functions must be atomic and typed, with independent acceptance criteria.
2. Stable group and function ids; no ambiguous duplicate provider actions.
3. All function refs resolve to the passed catalog; an unmounted function is rejected.
4. A function may mount in multiple distinct groups, never twice in the same group.
5. Local execution dependency cycles are rejected. External capability requirements
   are recorded as unresolved, not fabricated into a ready provider.
6. Traversal has resource-safety caps (input size, depth and node counts) rather than
   application-specific architectural limits.

## `forge.composite.impact`

Input: `{schema:'forge.composite.impact.request.v1', observed_revision,
trigger, changed_refs:[...], graph_intent:{nodes:[...], edges:[...]}}`.

Returns affected function refs, affected composite groups, draft UI revoke targets and
ordered **intents** to request external graph readback, UI revoke, TaskPool reconsider,
independent verification, UI refresh and atomic visibility. The adapter does not apply them.
This method checks structural consistency of the provided graph; the supplied revision
is **not proof of freshness or authenticity**. Real hosts MUST verify signed identity,
permissions, live revisions, and graph ownership on each operation.

## Publication invariants

A user request for a function does not automatically confer a working UI control.
`ui_drafts[*].invokable` remains `false` until independent verifier + host-owned
atomic commit + authenticated UI readback. Revocation has priority over repaint.
If a provider is missing, revoked or denied, the graph shows a diagnosed blockage and
reversible remedies; there is no silent write fallback, bypass or fake success.

## Test / deployment gates

`node tests/forge.test.mjs && node tests/forge-r02.test.mjs && node tests/forge-r03.test.mjs && node tests/forge-r04.test.mjs && node tests/forge-r05.test.mjs`.
Full repository CI and live MAS end-to-end delivery are separate gates and are not
implicitly satisfied by local contract tests. No migration of existing graph or memory.
