# Genesis Self-State R05 — independent candidate snapshot envelope

Status: **DRAFT / source only**. No real Genesis instance or production activation.

`apps/genselfstate` is a CPU-first, separately runnable MAS app exposing **`genesis.selfstate.snapshot.v1`**. It accepts caller-owned typed component states, `instanceId`, `lastEventId`, and an optional previously verified snapshot. It computes a canonical candidate envelope with a zero-based revision, per-component SHA-256 digests, parent digest, and top-level digest. Components are identified by versioned contracts, never by hardcoded optional provider IDs. It contains no model, UI dependency, persistent database, hidden long-term memory, tool invocation or motor authority.

## Explicit boundaries

- The output always has `origin:'candidate'`: not durable, not a live runtime attestation, not an identity/consciousness proof.
- The independent checkpoint service (draft #90) owns persistence and compare-and-swap. Durable sensor journal (draft #89) owns event sequencing and ACK. The caller commits state and event cursor **before** ACK.
- Immutable-by-copy input handling and deterministic sorted component records. Bounds: 24 components, nesting <=12, arrays/key-count <=64, string length <=2048, individual component <=64 KiB, entire envelope <=128 KiB.
- Invalid or cyclic JSON, nonfinite numerics, malicious object keys, repeated component slots, malformed contracts, mismatched instance IDs, repeated/null cursor after a previous snapshot, unexpected snapshot fields and digest corruption fail closed.
- SHA-256 is **integrity**, not authentication or authorization; event digest is not a monotonic sequence. Fresh provider rights, signed release, idempotent external outbox and fencing are separate concerns.
- Preserve ownership/history and validate schema migrations before switching cognitive providers. Serialized state alone cannot prove subjective continuity.

## Tests

```sh
node --test tests/genselfstate.test.mjs tests/genselfstate_service.test.mjs
```

Local Node 22.16.0: **4/4 PASS**. Includes 121 sequential hash-linked snapshots, replay/serialization, malicious inputs, an independent authenticated MAS HTTP process, graph schema and missing launch rejection.

Additional **local-only** cross-PR test (distributed in separate ZIP, **not** a runtime dependency or part of this independent GitHub branch): 30 durable snapshots via the atomic checkpoint provider from #90; reopened and validated checkpoints, stale expected-revision rejection: **1/1 PASS**. This does not test actual power loss/Windows crash semantics.

## Release gates

Independent full-repo MAS and Core+App isolation tests, architecture checker, Gauntlet review, native Windows filesystem QA, live permission-filtered graph, single-writer fencing, signed Lifecycle and verified real persistent Genesis remain open. **Do not auto-merge, install or activate.**

Related: [Dante P0 #47](https://github.com/Garyu-tt/AdamantiumToolBox/issues/47), [recursive composition #91](https://github.com/Garyu-tt/AdamantiumToolBox/pull/91), [checkpoint #90](https://github.com/Garyu-tt/AdamantiumToolBox/pull/90), [sensor journal #89](https://github.com/Garyu-tt/AdamantiumToolBox/pull/89).
