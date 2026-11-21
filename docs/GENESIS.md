# Genesis R01 — independent CPU-first brain incubator

Genesis is an independent MAS application, NOT a Mikoshi or Simulacrum submodule.
It owns brain instances, genome configurations, neural runtime state, snapshots,
and development operations. External world/body/XR connections are optional
capabilities supplied by other applications through typed adapters.

## Status and scope
- This revision is a **toy rate-neuron research prototype**, not a human,
  feline, or anatomically faithful nervous system. No claim of consciousness.
- Bounded CPU state: 1–256 simulated units per brain; up to 64 local brains.
- Runtime uses tanh updates, simple readout learning, one scalar chemical
  feedback regulator and stable logical neuron IDs.
- New units are introduced in shadow mode and require explicit integration.
  No guarantee that integration preserves all functions.
- Every mutation is atomically persisted. Snapshots are immutable,
  and fork creates a distinct instance without mutating the source.
- Background stepping is opt-in per brain with a persisted schedule and
  a capped number of CPU steps per scheduler cycle. Unconfigured brains
  remain paused. Pausing and restarting the service preserves the schedule.
- Existing Dante runtime and state are not migrated or modified.

## Recursive modules
The module loader discovers nested directories containing module.json
and handler.mjs. Module manifests declare their actions and permissions;
the graph and the generic Workbench are constructed from what is installed.
Modules may contain further submodules. There are no cross-app imports.

## API
The MAS GET /graph and POST /invoke contracts are host-delegated.
Actions include genome validation, brain create/list/inspect, CPU stepping,
readout learning, shadow growth, explicit integration, target expansion,
immutable snapshots and isolated forks. Instances use UUIDs.

ADA_GENESIS_DIR is an optional private data-root override.
Otherwise the local user runtime directory is used.
Do not store brain state or credentials in the public repository.

## Gates before release
Run node tests/genesis.test.mjs, node tests/isolation.test.mjs,
node tools/mas-check.mjs, python tools/check-size.py,
and python tools/architecture-check.py.
The live MAS deployment additionally needs approved permissions,
verified host identity, a trusted install route, and smoke tests.
Do not activate unreviewed code or use JediControl without live
authorized capability discovery.

## Planned independent modules
Detailed genome graph + chemistry, temporal scheduling, NeuroML import,
consolidation/regression, dynamic resource allocation, better visualization,
and versioned Genesis-to-Mikoshi sensor/motor stream adapters.
