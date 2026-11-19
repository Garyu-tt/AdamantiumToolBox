# Dante composite app R0 — bootstrap scaffold

Status: source-only **DRAFT**, not Genesis activation or a deployed application.

## Architecture

- `apps/dante` is an independently runnable MAS application (Core + Dante only).
- The host supplies a permission-filtered capability graph; no fixed provider names, ports, servers, nodes, or cross-app imports.
- A microplugin is an independently installed MAS provider declaring an action node with a typed `contract` field. `STAGES` contains interface identifiers, not provider IDs.
- The composer accepts exactly one visible provider per required interface. Zero means missing; more than one is ambiguous, not arbitrarily selected.
- The host app does not own Genesis, long-term memory, world physics, sensor transport, or renderer. Those remain separately managed providers.
- No activation is possible through this scaffolding. `runnable` stays false without live Genesis attestation, QA, and signed Lifecycle approval. The UI must not imply a mock agent is Dante.
- `dante.status` is a read-only action, and the app needs only `dante.read`.
- Raw UI remains functional without Leonardo and without other optional apps.

## Provider contracts (stage identifiers)

1. `dante.world.observe.v1` — observe world state
2. `dante.sensory.deliver.v1` — bounded event transport, ACK/replay
3. `dante.genesis.apply.v1` — persistent live cognition, not a mock
4. `dante.motor.command.v1` — typed action selection
5. `dante.world.apply.v1` — apply action with feedback
6. `dante.state.checkpoint.v1` — atomic bounded versioned checkpoint
7. `dante.state.restore.v1` — verify and restore state on restart

An action provider may publish `contract` on a graph node. This field is metadata permitted by current `validateGraph`; the current Core forwards node metadata after authorization filtering. **Discovery alone is not evidence of execution**.

## Further gated stages

- Confirm real Genesis runtime/owner/state schema. If absent, block, never relabel a mock.
- Integrate the existing draft sensory bus (#46), checkpoint (#49) and mock-world (#55) only after independent QA; do not duplicate their files.
- Add an explicit runtime session/trace protocol and test 100+ CPU ticks, error injection, durable replay, crash/restart and deterministic readback.
- Verify Core + Dante isolation and native Windows smoke before signed Lifecycle. No auto-activation or merge.
- Do not expand scope into 3D world, food, media library, UI skins or Wayfire during P0.
