# Database R01: Recursive Graph Fabric Store

Status: experimental, single-host. Core + Database is sufficient; Noosphere is not required. The plugin owns its data directory, and Noosphere 3.0 consumes capability contracts, never Database's private files.

## Recursive assembly
The generic loader `core/modules/runtime.mjs` walks module manifests under `modules/`, resolves typed requirements against available versioned capabilities, and activates eligible modules. Nesting depth is not hardcoded. Module paths express ownership, not dependencies. Missing/disabled/broken modules do not publish actions. Each component declares its explicit isolation boundary.

The loader may catch in-process activation and call errors. It cannot contain native faults, OOM, or deliberate process exits. Dedicated worker isolation is reserved and NOT IMPLEMENTED. Module version hot-swapping and multi-host execution are not implemented.

## Module layout
- `storage` container -> `journal` append-only Graph Fabric Store.
- `indexing` container -> `subjects` limited scan-based projection, NOT a persistent index.
- `sql-adapter` and `replication` disabled: no phantom API actions.
- `database.modules` exposes active, disabled, failed or blocked module status.

Disable a subtree by `DATABASE_MODULE_POLICY='{"indexing":false}'`. Module discovery requires no fixed module list in Core.

## Graph Fabric Store
Canonical fact has `uid`, `subject_uid`, `relation_uid`, `object_uid` or `typed_value` and temporal/provenance metadata. The single-writer journal supports ASSERT/RETRACT, optimistic `observed_seq`, history and at-sequence queries. SQL is not canonical.

Exposed action IDs: `database.status/query/history/transact/subjects`, mapped in the dynamic API graph to `storage.graph.*` semantic capability IDs. Existing Toolbox Core still invokes a concrete action ID; policy-based provider routing is future work.

Data resides in `DATABASE_DATA_DIR` or the user's runtime data home, outside the plugin installation. Noosphere must not import storage code or read private Database paths.

Example mutation:
```json
{"action":"database.transact","params":{"namespace":"noosphere","observed_seq":0,"mutation_uid":"tx-01","operations":[{"kind":"ASSERT","fact":{"uid":"fact-01","subject_uid":"dante","relation_uid":"observed","typed_value":"a ball"}}]}}
```

## Safety and acceptance
Not production-ready for irreplaceable memory: no encrypted storage, per-caller/tenant ACL, independent replicas, reliable crash recovery, distributed consensus, durable index, hot migration or cross-node transactions. Existing delegated auth does not identify individual callers. Keep legacy Noospheres unchanged. Run database, module, HTTP and Toolbox integration tests before deployment.
