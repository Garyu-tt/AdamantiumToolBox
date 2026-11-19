# Genesis P0 microplugin: sensory normalization

Status: **DRAFT, tested source only**. This is a genuine CPU-only stateless provider of one sensor-data transformation contract, NOT a neural model or real Genesis activation.

## Independence

- `apps/genormalize` is a standalone MAS app. It imports no sibling application or cognitive model; it runs as `Core + App` without Dante, world, Noosphere, GPU or renderer.
- Its `genormalize.normalize` action publishes the versioned contract `genesis.sensory.normalize.v1` and consumes `dante.sensory.event.v1`.
- Provider identity is **not hardcoded** in its parent: the generic recursive resolver matches its contract in the caller's authorized graph. Genesis Perception's next required contract is `genesis.sensory.integrate.v1`.
- The output `genesis.sensory.normalized.v1` contains bounded top-level numeric signals (max 16), unchanged raw values, canonical SHA-256 of bounded payload, source/kind/sequence/time and optional trace ID. No invented calibration, emotions, meaning or latent thought.
- Input normalization canonicalizes JSON object keys recursively, rejects invalid shape/NaN/Infinity/cycles/depth>8/large strings and dangerous keys, and bounds serialized payload.
- The HTTP service listens only on loopback, requires the MAS internal key, restricts request body size and has a read-only UI.
- `runnable:false` for composite Genesis until all required modules are verified and a signed/runtime-attested `dante.genesis.apply.v1` binding actually exists.

## Test

```sh
node --test tests/genormalize.test.mjs tests/genormalize_service.test.mjs
```

Local Node.js v22.16.0: **PASS 3/3**. Includes byte-for-byte canonical output test, malicious/oversized/cyclic rejection, separate HTTP process, private auth guard, graph metadata, invocation and refusal to launch an absent Genesis.

Additional repo-wide gates before any merge or installation: `node tools/mas-check.mjs`, `node tests/isolation.test.mjs`, `python tools/architecture-check.py`, independent Gauntlet, signed Lifecycle and native Windows smoke. These are **not yet verified**.

## Next microplugin

A separate `Genesis Sensory Integrator` will consume normalized events and maintain its **own versioned bounded temporal context**, with checkpoint and trace/cursor contracts. That work does not belong in this normalizer. Later: world-model updater, proposal generator, decision selector and self-state snapshot ownership, each independently testable.

Refs architecture PR #91, Dante critical path #47, sensory queue #89, state checkpoint #90.
