# Universal Graph G3 — GENESIS read-only projection

**Status: draft integration adapter, not a neural executor, permission broker or running MAS service.**

Module: `apps/universal_graph_genesis/bridge.mjs`. Depends only on the exact clean G0 Graph IR schema at `standards/universal-graph/graph-ir-v1.schema.json`. Headless, CPU-first, no editor/runtime/network dependency.

## Roles

- `genesis.pe.graph.v1` region → `brain-region` node with `genesis.region@1` contract.
- `genesis.pe.graph.v1` hub → `service` node with `mechanicus.connector.hub@1` contract.
- `synapse` *projection* → typed `signal` IR edge with an explicit **positive tick delay**; it is not a claim of allocated synapses, timing, chemical state or actual processing.
- `route` declaration → typed `route` edge; no network configuration or access rights are applied.
- Existing versioned GENESIS capability port contracts `.v1` become the mechanically equivalent `@1` IR types with an explicit `cap_` prefix, and original port name aliases are returned as read-only provenance.
- **No** weights, neuron IDs, memory, chemical concentrations, genetics, GPU state, tokens, secrets, IPs or host addresses are copied. Source genome remains owned by GENESIS; Noosphere persists independent temporal state.

## Run converter

On a machine with Node.js 22+:

```sh
node apps/universal_graph_genesis/convert.mjs path/to/genesis-pe.snapshot.r04.json > genesis-universal-graph.json
```

The input can be a bare GENESIS graph or an R02/R04 snapshot wrapper containing a `graph` field. The generated JSON has precisely the **G0** IR graph fields, so a future Rete view can load the graph without owning execution. No source file is modified.

## Safety and validation

- Reject invalid/duplicate G0 IDs instead of silently renaming them: stable references must not shift.
- Reject missing endpoints, duplicate edges, malformed source port contracts, unexpected node/edge kinds, unbounded counts and zero-delay neural edges.
- Stronger cross-model validation remains a follow-up: the C++17 G0 compiler presently validates typed in-memory structs, not arbitrary imported JSON. G3 tests exercise this mapping; they are not native compiler differential-conformance proof.
- G0/G2/G3 branches remain separate draft layers; do not auto-merge or activate without revision/CAS/authorization reviews.

## Independent acceptance

`node --test tests/universal_graph_genesis_export.test.mjs`

Six tests cover CPU-only projection, R02/R04 wrapper input, route-versus-signal semantics, required delay, adversarial identifiers and 512-region graph performance. GitHub CI executes them on Linux and Windows. No Rete or external package dependency is required.

## Integration next

1. Bind G3 output to G2 Rete v2 visual adapter; keep Rete replaceable and graph state authoritative outside the editor.
2. Add explicit Graph Manager revision-bound mutation proposals; never edit genome or neurochemistry from a mere view projection.
3. Add registered type bindings from the verified live capability registry, not guessed providers.
4. Expose the importer as a MAS capability only after policy, schemas, C++/JS differential fixtures and per-node budgets are reviewed.
