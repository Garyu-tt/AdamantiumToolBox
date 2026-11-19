# Universal Graph IR R01 — editor-independent MAS graph language

**Status: source-only candidate, not deployed and not an authorization engine.**
Parent rules: ADR-0001, ADR-0002, Typed Capability and Graph Manager.

## Decision

A universal graph is a portable versioned description of a program, network, neural region, UI, policy relationship or recursive composite. It is NOT an implicit executable script, host connection, remote service discovery result or permission grant.

The canonical representation is mas.universal-graph.v1, validated by the pure module apps/universal_graph/ir.mjs. Rete.js v2 (candidate), a CLI, Graph Manager and runtime plugins may consume the same description through independently installed adapters. Closing the GUI must not stop any executor.

Existing sdk/graph.mjs, Core /graph, Graph Manager and GENESIS Portable remain unchanged. Explicitly version any future adapter.

## Typed node/edge semantics

- Nodes: capability, composite, neural_region, resource, device, ui and policy.
- Ports: ID, in/out direction, semantic role and versioned datatype.
- Edge roles: data, control, event, neural, authority and dependency. A valid edge connects matching roles and datatypes and correctly directed ports.
- Capability binding stores a versioned contract, NOT a live authorized provider handle. Composite graphRef pins graph ID + revision, not an arbitrary path.
- Data/control/dependency connections must be acyclic. Neural/event feedback requires an explicitly flagged feedback edge; domain executors own timestep, event ordering, delay and backpressure.
- Authority links are descriptive only. Runtime RBAC, provenance, revocation and explicit authorization are separately enforced and cannot be granted by editing an edge.
- UI layout and themes are view state. Weights, chemical concentrations, neuron records, events and checkpoints belong to GENESIS, Noosphere or their owning runtime.
- Graph nodes store typed references, not large tensors or per-neuron DOM data.

## R01 pure APIs

- validateUniversalGraph(graph, budgets): validates version, IDs, semantic ports, bounded nodes/edges and cycles.
- editorProjection(graph): produces non-executable, non-authorizing view data for Rete or a fallback canvas.
- planGraphComposition(rootId, documents, budgets): resolves pinned subgraphs, checks cycles and depth. Always returns runnable:false. Activation is another authorized service.

Defaults: up to 512 nodes, 4096 edges and 16 recursive graph levels in this slice. Budgets are tunable, not final scale limits.

## Rete licensing

Rete.js v2 remains optional. The Rete license page explicitly excludes rete-scopes-plugin and rete-structures from ordinary commercial MIT permissions: these advanced packages are CC-BY-NC-SA-4.0. For a commercial Toolbox avoid bundling them; use independently developed traversal/nesting or negotiate a separate license. https://retejs.org/docs/licensing/

The R01 IR requires no npm packages, mandatory GPU or network. Do not copy implementation code from non-commercial Rete plugins.

## Acceptance gates

1. MAS program: loader → weight restore → consumer; visible typed dataflow but no implicit execution.
2. GENESIS: connected neural regions with explicit feedback; real neuron runtime remains separate.
3. Infrastructure: server and policy claim view; no authorization implied.
4. Nested composites: pinned child revision, reject missing or cyclic graph, enforce depth/budget.

Test: node --test tests/universal_graph_ir.test.mjs (Linux/Windows CI). This test does NOT prove a real distributed runtime is running.

## Next independent slices

R02: read-only Universal Graph MAS Core+App provider with isolation and permission-filtered graph discovery.
R03: optional Rete.js v2 UI adapter with verified dependency licenses, static fallback and no canonical schema coupling.
R04: runtime binding adapter with verified live capabilities, task-specific CPU/GPU/NPU scheduling, leases, receipts and revocation.
R05: GENESIS region graph adapter, large graph virtualization, stable Noosphere state references.
