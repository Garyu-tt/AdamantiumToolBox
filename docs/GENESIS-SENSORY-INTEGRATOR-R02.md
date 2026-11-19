# Genesis Sensory Integrator R02 — independent microplugin

**Status:** source-only draft. No real cognitive engine, signed activation, Windows deployment or production memory guarantee.

## Purpose

`apps/genintegrate` is the second small leaf of `Genesis → Perception`, after the independent normalizer in draft PR #93. Its single capability is `genesis.sensory.integrate.v1`. It accepts `genesis.sensory.normalized.v1` and an *explicit caller-owned* `genesis.sensory.context.v1` snapshot, then computes a new candidate state. It has **no private memory**, no knowledge graph, no LLM/brain, no live Genesis, no storage, no fixed dependency on a sibling app, and no network calls except its own loopback MAS HTTP service.

The output `genesis.sensory.integration.v1` contains `integrated` or `duplicate`, a stable event ID, a new context snapshot and bounded per-channel temporal statistics (last/mean/min/max/count). Numeric signals remain **raw**: this is not emotional interpretation, comprehension or inference.

## Replay and state consistency

- Event ID is `sha256(JSON.stringify([source,kind]) + NUL + sequence)`; matches durable sensor-journal PR #89 for the same source/kind/sequence.
- Cursor per source/kind tracks latest sequence and payload SHA. Exact repeated sequence and digest returns `duplicate` without an additional count. Different digest at same sequence is **conflict**. Older sequence is **regression**, skipping ahead is **gap**; all fail closed.
- Default budgets: max **32 source/kind streams**, max **32 recent events**, maximum **16 finite numeric signal values** per input; absolute limits are 64 streams/events. Event representation limited to **4 KiB**, complete context to **64 KiB**, service request to **75 KiB**.
- Everything uses deterministic input timestamps and supplied state; no wall clock, timers or background tasks.
- Budget changes must be explicit migrations if they invalidate an existing context; no silent truncation of older state.
- The integrator performs a pure transform. It does **not** ACK events or commit the returned candidate state.

## Required atomic handoff across MAS plugins

1. Durable Sensor Journal: `peek()` an unacknowledged event and preserve its ID.
2. Stateless Genesis Normalizer (#93): normalize source event.
3. Stateless Genesis Integrator (R02): read **checkpointed** context, produce candidate context and check event ID.
4. A future genuine cognitive provider may process it. For fixture tests only use deterministic CPU World—never relabel it Genesis.
5. External state service (#90): commit all relevant candidate state with `lastEventId` **before** ACK; protect stable instance ID and expected revision.
6. Sensor Journal: ACK only after verified durable commit. On restart, compare durable cursor/ID and deduplicate.

Exactly-once physical/network side effects are **not guaranteed**. They require an idempotent outbox, recipient receipts and fencing. Noosphere replication and subjective experience remain out of scope.

## Verification

```bash
node --test tests/genintegrate.test.mjs tests/genintegrate_service.test.mjs
```

Local Node.js 22.16.0: **5/5 PASS**. Tests cover replay, boundaries, input immutability, temporal summary, malicious key rejection, conflict/gap/regression, finite extreme-value mean, isolated HTTP process, MAS manifest/graph/auth and refusal to fake a launch action. All **9 uploaded source/test blob SHAs match** the locally tested files.

Cross-PR local integration (kept outside this independent PR while dependencies remain drafts) used CPU world fixture, Sensor Journal #89, Normalizer #93, this Integrator and Checkpoint #90: 120 ticks, restart before commit, restart after commit before ACK, one replay safely skipped; serialized world and perceptual context identical to crash-free baseline.

Release blockers: full repository `node tools/mas-check.mjs`, `node tests/isolation.test.mjs`, `python tools/architecture-check.py`; independent Gauntlet, Windows smoke, signed Lifecycle, interprocess fencing and hard power-loss QA. No merge or deployment.

Related: composite recipes #91, normalizer #93, Dante #47, sensor queue #89, checkpoint #90.
