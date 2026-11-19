# ADR-0003 — Mechanicus Universal Graph is the canonical IR

Status: **PROPOSED, source-only prototype**; 2026-11-19 user-directed clean redesign.
Tracks #141. Does not authorize runtime changes, source merges, installs or restarts.

## Decision

One versioned, language-neutral **Universal Graph IR** defines the structure
of composable programs, capability providers, neural/GENESIS graphs, hardware
and infrastructure descriptions. This is a **semantic model**, not the
execution engine or UI framework.

Rete.js v2 is a planned **replaceable graph editor plugin**. Rete core and
many official plugins are MIT, but official licensing explicitly classifies
`rete-scopes-plugin` and `rete-structures` as CC-BY-NC-SA-4.0, not suitable for
commercial redistribution without separate permission. Neither will be
installed, copied or transitively imported by the commercial editor adapter.
Subgraphs will use **native GraphRef + InterfacePorts**, not either of these
advanced packages. A dependency license report is mandatory on the UI PR.

References:
- https://retejs.org/docs/
- https://retejs.org/docs/licensing/
- https://retejs.org/docs/guides/modules/

## Canonical shape

The JSON contract is `standards/universal-graph/graph-ir-v1.schema.json`:
- Graph: `schema, id, schemaVersion, revision, domain, interfacePorts, nodes, edges`.
- Node: `id, kind, typeRef, graphRef, ports`; exactly one kind of implementation
  reference. A composite additionally pins `graphRefRevision`; the parent
  Graph pins `revision` for deterministic nested composition. `typeRef` may describe a compute function, service, device, UI,
  resource, sensor/effector, region or policy; it is not code or private state.
- Port: `id, dataType, direction, semantics`. Ports use explicit versioned
  type contracts, rather than permissive implicit type coercion.
- Edge: endpoints, semantics, delayTicks. **Permission/route** edges never
  enter the compute dependency scheduler. Data/control/dependency form DAG
  constraints, with event/signal feedback permitted only across a delay.
- Composition: graphRef names a separately versioned graph definition;
  exposed ports must exactly match its interface. Cyclic self-import and
  transitive module recursion are invalid. Max depth is configurable.

The headless C++17 structural compiler lives in `native/universal-graph`,
with no dependency on Node.js, editor, Qt, CppMicroServices, Wayfire or GPU.
It validates names, exact port types/directions/semantics, graph references,
cycle rules, input caps, max depth and limits. It does **not** execute a single
operation; no graph node can confer privileges or start a service.

## Responsibility split

1. **Universal Graph IR**: stable structures and validation, immutable
   versioned graph packages, no secrets.
2. **Graph Manager MAS plugin**: graph lifecycle, CAS revision, change events,
   dependency metadata, rollback; not part of this core IR.
3. **Capability Registry MAS plugin**: independently discovers actual trusted
   implementations by typeRef and supported port contracts.
4. **Policy + Auth MAS plugins**: independent actor authentication, signed
   capabilities, ephemeral permission leases and point-of-use verification.
   Permission edges are *only descriptions*, never grants.
5. **Execution adapters**: independent native/Frankenstein/Python/Rust/CPU/
   GPU/NPU/remote backends chosen from measured compatibility and budgets.
6. **Noosphere MAS**: persistence, provenance, time and replay; external to IR.
7. **Rete Editor MAS**: projects the IR for people; drafts edits as validated
   transactions; no authoritative state, scheduling or execution. Headless
   agents/servers continue when the editor is closed.

## Different semantics stay different

- Program: type-safe data/control edges and nested modules. Runtime dispatch
  will require separately authenticated explicit action invocation.
- GENESIS: tensor handles, genome references, memory budgets, hardware route
  hints; massive matrices are **opaque external resources**, not editor nodes.
- Neural: signal/event cycles are scheduled via positive tick delays; raw
  instantaneous recurrence rejects rather than recursion-locking the host.
  A specialized neural scheduler defines the actual tick semantics.
- Infrastructure: route and permission/dependency edges are declarative,
  not firewall commands or automatic network grants.

## Three G0 acceptance cases

`native/universal-graph/tests/universal_graph_test.cpp` checks:
1. MAS composite program with exact module boundary contracts.
2. GENESIS CPU pipeline: genome.ref → tensor.handle plus route hint.
3. Dante brain: signal feedback loop allowed only with delayed edge.

Negative tests cover bad type, mismatched semantic ports, instantaneous
cycles, recursive modules, incorrect composite interface, invalid graph
version/ID, duplicate nodes, malformed typeRefs, resource/depth caps, and a
10,000-node CPU-only structural validation sample. Native Linux+Windows CI
must pass the **same commit** before a PR becomes review-ready.

## Explicit non-goals / gates

G0 does not define a stable C ABI, JSON serializer/parser, on-disk
transactions, a Rete UI, authorization, native executor, graph-to-provider
binding, network/WireGuard policy application or live migrations. These
require separate plugins/increments and a reviewer-verifiable versioned
contract. Do not reuse drafts #134–#140 as dependencies of G0.

The old N0–N3 PRs are deliberately left in GitHub as **Draft research**,
unmerged and without branch deletion. No core migration is approved until
new G0–G5 gates and reversible cutover pass.
