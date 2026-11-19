# ADR — Adamantium AI Core: mobile AI compute and federated phone capability gateway

Status: **R01 source-only Android adapter/experiment**. Not deployed, not an accepted production node. Related to platform #120, native ABI #133/#134, Conversation Hub #82/#83, Browser MAS and Adamantez source boundary.

## Boundary
Adamantium AI Core is the Android AI workload host and an outbound permissioned gateway to phone resources. It is not a second Adamantium MAS microkernel, a new server, or a modified toolbox shell. Its UI presents a remote authorized Conversation Hub when available; the Android watchdog lives independently of chat.

```
Android UI (optional Chat Hub / LibreChat via HTTPS)
       |             Android opt-in watchdog
       |                   |
  conversation         device probe + identity + thermal/power gates
  capability                    |
                          provider registry <-> GENESIS descriptors
                          | CPU dense-f32 v1
                          | optional ALT / llama.cpp / TFLite / Vulkan
                          | optional camera, mic, browser, sensors (separate consented grants)
                                  |
                     HTTPS + pinned TLS SPKI + signed envelopes
                                  |
                   approved MAS pool / graph action dispatcher
                                  |
                 measured cross-architecture task planner
```

## Separation of concerns
**Genes**: immutable structural descriptors (input/output tensor schema, precision, backend requirements, API contract, cost accounting, min RAM), mutable measured/calibration genes (latency, joules, thermal, failure rate, accuracy per device/model), and optional learned/weight-reconstruction genes (future ALT × GENESIS provider). Descriptors cannot bestow Android permissions. Acquire measurements through verified benchmarks, never pretend presence of a GPU/TPU proves a working delegate.

**Neural task specializations**: orchestrator, to-do classifier, memory summarizer, chat model, browser vision/controller, and task compiler can all be AI-backed **optional capabilities**. Deterministic event commit, security checks, lease fencing, identity, budget enforcement, backpressure and rollback are not probabilistic neural outputs.

**Gateway**: each phone explicitly joins an operator-approved pool. First-party user-approved sensors/effectors are separate MAS nodes with scoped permissions and platform permission checks. No unrestricted phone remote shell, Accessibility, camera/mic, contact access, content inspection or arbitrary app interaction.

## Protocol `android-ai-pool-v1` (draft)
User configures an HTTPS base URL and its Base64 SHA256 SPKI pin (full certificate chain verified normally, then pin matched). Client Android Keystore generates a non-exportable P-256 signing key. No fixed host, port, phone identifier or long-lived bearer token in public source.

For `POST /api/ai-core/v1/pulse` and `POST /api/ai-core/v1/results`:
- `X-AI-Core-Node`: SHA256 hex of DER encoded public key.
- `X-AI-Core-Key`: Base64 DER public key.
- `X-AI-Core-Timestamp`: Unix milliseconds.
- `X-AI-Core-Request`: fresh UUID, unique per request.
- `X-AI-Core-Signature`: Base64 ECDSA SHA256 over UTF-8 `POST\\n<path>\\n<timestamp>\\n<request-id>\\n<base64(SHA256(body UTF8))>`.

The **server** must independently validate trusted TLS entry, enrolled key, signature, exact path, timestamp window, request ID replay, role, quota, per-task lease, idempotency key, allowed operation and requested dimensions. Reject unknown keys. Enrollment is an explicit independent administrator step, NOT first-contact trust.

Pulse includes `capabilities` and `status`; response optionally contains a leased `job` object with `id`, `op:'ml.dense.f32'`, `expiresAtMs`, `input`, `weights`, `bias`, `activation`. R01 restricts total multiply-adds, result sizes and thermal/battery states. A result is a signed `{jobId,op,result,completedAtMs}`; the coordinator must idempotently accept by `(node,jobId)` and never reissue unacknowledged ambiguous mutations without a readback protocol. On disconnect, lease expiry lets an authorized pool reassign work. Results must not be applied twice.

Future provider interfaces negotiate `ops, model_format, tensor shapes, quantization, precision, memory, delegate, measured throughput, latency, joules, health, opt-in scope`. Planner scores **feasible backend per task** including network transfer, queue and thermal cost; measured CPU may beat nominal GPU/NPU for tiny batches. Mobile may act as chat frontend even when no compute available.

## Watchdog lifecycle
- Explicit Start/Stop via Android foreground service with persistent notification. `START_STICKY` and best-effort boot receiver if user opted in; never claim OS cannot kill it.
- Pulse every 45 s when service runs and network is available; bounded connect/read timeouts; no indefinite wakelock. Fail closed on invalid HTTPS/pin/registry.
- Set `available=false` if battery below 40% while unplugged, thermal state worse than moderate, or other device constraint fails. Stop stops local tasks; server must expire stale leases via TTL.
- `specialUse` FGS on API34+ is declared specifically for opt-in federated inference, subject to Android OS and distribution policy. If rejected, user-initiated sessions and periodic WorkManager/JobScheduler (with quotas) are the fallback. Battery optimization exemption needs a separate conscious user action.

## R01 implementation boundary
A CPU dense layer kernel is included to exercise end-to-end architecture, not as a claim of full LLM inference. No GPU, NPU, TPU, Vulkan, Gemini Nano or local ALT engine integration is shipped here. In particular, NNAPI deprecated in Android 15; use provider-specific tested execution backends when available, never assume the Pixel AI chip is a generic programmable accelerator.

## Next independently testable deliveries
1. Pair gateway server bridge to versioned MAS capabilities and transactional lease queue. Independent failure tests and real RTT measurements.
2. Attach real local model backend (llama.cpp CPU / Vulkan on supported hardware), contract tests and on-device profiling; then test supported accelerator delegates.
3. Wire eventful Conversation Hub streaming/cancel/context and LibreChat client, not a duplicate chat stack.
4. Capture transferable GENESIS learned calibration genes, confidence intervals, regression fingerprints and rollback.
5. Device-attested grants for specific phone capabilities, granular UI permission prompts, audit, revocation and zero-trust routing.
