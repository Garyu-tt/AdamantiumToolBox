# Genesis World Model R03 — observed-state microplugin

**Status:** independent draft source, CPU-only, no active Genesis and no deployment.

## Scope

\`apps/genworldmodel\` publishes \`genesis.worldmodel.update.v1\`. It accepts **caller-owned** \`genesis.worldmodel.state.v1\` plus one \`genesis.sensory.normalized.v1\` event. It computes a candidate updated world representation, not durable storage or cognitive decisions. The entire plugin works in isolation with Core + App; the input may come from the separate normalization plugin in PR #93 but there is **no direct source import or mandatory runtime dependency**.

- One observation stream \`[source, kind]\` becomes one bounded **stream entity** (a record of related signals). This is NOT physical object identity, detection, segmentation, semantic grounding or recognition.
- Each feature contains its latest numeric value; the update result includes previous, current, delta and rate per supplied millisecond if meaningful. Overflowing differences become \`null\`, never Infinity or NaN.
- A canonical SHA256-derived event ID matches the separate durable journal PR #89 when source, kind and sequence match. Sequence gaps/regressions, repeated sequence with changed payload hash and timestamp regressions fail closed.
- Exact repeated events are idempotent: no change in revision or observation state.
- Limits: 32 streams by default (64 configurable), up to 16 scalar numeric features/stream, 4 KiB event, 64 KiB entire state. Versioned data; no time-based background work and no GPU dependency.
- No learned inferences yet: this is only a bounded baseline for independently implemented object tracking, spatial relationships and predictive models.

## Correct integration order

1. Sensor journal \`peek\` (PR #89) produces a stable event ID.
2. Stateless normalizer (PR #93) transforms the event; temporal integrator (PR #97) and world-model reducer each compute *candidate* outputs.
3. Genuine Genesis/policy (not yet implemented) may consume the candidates.
4. Checkpoint service (PR #90) commits the necessary candidate state and the \`lastEventId\` as one revision before journal ACK.
5. Only after that commit may the consumer ACK. If a restart occurred after commit, the already-committed event is ACKed without applying again.

This protocol is safe for deterministic state transforms coupled to one checkpoint; it **does not** provide exactly-once side effects on physical or independently persisted remote systems. Those require outbox/receipts/fencing. None of these drafts prove continuity of subjective identity.

## QA

\`\`\`sh
node --test tests/genworldmodel.test.mjs tests/genworldmodel_service.test.mjs
\`\`\`

Local Node 22.16.0: **6/6 passed** (immutable updates, multiple sources, input validation, replay/gaps/conflicts, finite extreme math, 120 serializations, authenticated separate MAS child process and refusal of fake Genesis activation).

Separate **cross-PR local fixture**, excluded from this independent GitHub PR until dependencies are merged:

\`\`\`sh
node --test tests/genworldmodel_stack_e2e.test.mjs
\`\`\`

Local result: **1/1 passed**, 120 ticks of mock world + durable journal + normalization + temporal context + world-model + atomic checkpoint, 2 simulated process/state reloads and 1 replay safely skipped; final full state matches clean baseline. **Not** actual power-loss testing, true Genesis, native Windows proof or deployment.

## Release blockers

Full repository \`node tools/mas-check.mjs\`, \`node tests/isolation.test.mjs\`, \`python tools/architecture-check.py\`, independent Gauntlet, native Windows E2E, signed Lifecycle approval, interprocess single-writer leases and real persistent cognition remain unverified. Do not merge/activate automatically.

Related PRs #47 #90 #91 #93 #97 #89. World Model P0 is a useful *leaf*, not the end of Genesis development.
