# Dante State Checkpoint R2 — independent MAS microplugin

**Status: DRAFT / source-only.** Tested locally on Node.js 22/Linux; no live Genesis or installed runtime claim.

## Composition contract

- `apps/dantecheckpoint` is a standalone MAS application, independent of world, sensory, motor, Noosphere, Leonardo and the Core internals.
- `dantecheckpoint.commit` implements `dante.state.checkpoint.v1`; `dantecheckpoint.restore` implements `dante.state.restore.v1`.
- An owner-supplied `DANTE_CHECKPOINT_PATH` or owner-private default controls the state destination. Real instance state must reside **outside** the plugin install tree.
- Atomic storage algorithm is bundled from draft PR #49, pinned blob `644f964cedb359b8fd4b7f840c5015b3e425fe21` (SHA256 integrity, exclusive temporary file, file fsync, atomic rename, best-effort parent directory fsync).
- The manager adds `dante.state.session.v1`, stable `instanceId`, monotonic `revision`, and `lastEventId` in a single persisted record.
- `commit` is expected-revision compare-and-swap **within one service process**. It snapshots input before pending asynchronous work and serializes writes, then publishes the revision in memory only after disk save.
- A different `instanceId`, outdated revision, repeated last event, null cursor regression, invalid/oversized/cyclic state or corrupt checkpoint fails closed.
- This store persists supplied state bytes: it does **not** generate cognition, prove real-world side effects or protect subjective identity.

## Safe replay protocol for a single deterministic virtual-world fixture

1. `peek` an unacknowledged event from durable sensor journal PR #89.
2. `restore` the latest checkpoint. If `lastEventId` equals the pending ID, **ACK and do not reapply**.
3. Otherwise calculate a **candidate** world/brain state without irreversible external side effects.
4. `commit` candidate state with `lastEventId`, verify persistence.
5. Only then publish the candidate to the in-memory world and `ACK` the event.
6. On restart restore world from checkpoint and redeliver unacked events.

**Important limitation:** this works for a world whose state can be atomically restored with the cognitive snapshot. A physical actuator, network action or independently persisted world requires an idempotent outbox and durable recipient receipt. The 120-tick test does not establish distributed exactly-once semantics.

## Reproducible local evidence

- `node --test tests/dantecheckpoint.test.mjs tests/dantecheckpoint_service.test.mjs`: 3/3 tests PASS.
- An additional R2 local integration probe packages exact code from PR #89, PR #86/#55, and this checkpoint plugin: 120 ticks; crash after checkpoint before ACK (replay, no duplicate effect); crash before checkpoint (reapply); final snapshots equal baseline. This probe is distributed separately in the source bundle, not merged as an independent test dependency into this branch.

## Gates / blockers

- Single-writer fencing/lease across OS processes is **not implemented**. Run exactly one writer per path; do not enable automatic failover.
- Crash injection after `fsync` and before/after `rename`, hard power cut, Windows NTFS semantics, symlink/path defenses, state schema migration and resource metering require independent QA.
- No signed Lifecycle delivery or native Windows readback. Run repository-wide `node tools/mas-check.mjs`, `node tests/isolation.test.mjs`, `python tools/architecture-check.py`, then Gauntlet.
- `Core + dantecheckpoint` isolation must pass independently.
- Real persistent Genesis provider remains **unverified**. A scripted deterministic fixture must never be represented as Dante.

References: [critical path #47](https://github.com/Garyu-tt/AdamantiumToolBox/issues/47), [atomic source #49](https://github.com/Garyu-tt/AdamantiumToolBox/pull/49), [composite #85](https://github.com/Garyu-tt/AdamantiumToolBox/pull/85), [world #86](https://github.com/Garyu-tt/AdamantiumToolBox/pull/86), [sensory #89](https://github.com/Garyu-tt/AdamantiumToolBox/pull/89).
