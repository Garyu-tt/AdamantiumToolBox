# Mechanicus Graph Manager 0.1.0 — read-only first slice

## Scope

Independent MAS app (`Core + graph_manager`). It reads the **already permission-filtered**
backend graph supplied by the host UI, then projects capabilities and visible owners
into a typed operational graph. No Core changes, hardcoded peers or direct app imports.

## Operation

- Filtering: text, graph layer, blocked status; select any node for provenance and
  diagnostic metadata if the owning provider explicitly supplies it.
- Edges: visible Core edges plus derived plugin containment. Missing endpoints are
  counted rather than forged. Cycles are reported and do not recurse forever.
- Blocker impact is calculated only from explicit `depends` edges. Graph properties
  are **not** evidence of deployed services or agent execution.
- Export serializes the current permission-filtered snapshot. Treat as potentially
  sensitive: the user explicitly clicks the export control.
- Update: host graph polling (2.5 s). The current shell refreshes its source graph
  every ~12 s; the UI does not yet have a typed push subscription. It stops polling
  when its window disconnects. Read-only provider absence is normal.

## Optional structured metadata

A provider may publish an `entity` object on a visible capability node:
`{schema:"mas-graph-entity-1",kind:"task",status:"blocked",reason:"...",diagnostic:"...",
source:"...",responsible:"...",remediation:"..."}`.
This is descriptive, not an authorization token. The v0.1 renderer must never execute
arbitrary remediation instructions or call a diagnostic attachment endpoint.

## Constraints / next steps

Graph Studio remains responsible for editing frontend bindings; Graph Manager does
not replace it. Keep Task Pool, Orchestrator, Noosphere and Conductor registry optional.
Later milestones: signed provenance for external provider entities, hot-update events,
RBAC-gated diagnostic attachment with receipt, graph viewport virtualization for large
networks, and independent accessibility/visual tests. **Not deployed.**

Run `node tests/graph_manager.test.mjs` and `node tests/graph_manager_runtime.test.mjs`.
Complete CI including `tests/isolation.test.mjs` before review or merge.