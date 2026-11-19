# Native dispatcher N2a — bounded READ-ONLY in-process provider calls

**Status:** experimental source-only acceptance slice; depends on N0 PR #134
and N1 PR #135. Tracks #133. This is NOT a replacement for Node MAS Core
or proof of a trusted/multi-process runtime.

## Intent

A minimal, headless C++17 host invokes a test provider written and compiled
as plain C11 through a versioned ABI (`standards/native/mas_read_provider_v1.h`).
It does not import CppMicroServices, Qt, Wayfire, Node, HTTP or private source.

The public callback ABI passes bounded, length-delimited byte spans and a
host-owned reply buffer. The callback MUST be synchronous; it may only use its
buffers during the call and MUST NOT cross the ABI with exceptions, STL values,
heap ownership or persistent pointers. A cancellation query is cooperative.

## Local trust boundary, not production authorization

- `ReadOnlyDispatcher` is a **host-internal C++ object**, not an externally
  accessible API. Its `authenticated_principal` is a caller-supplied string:
  only a future authenticated ingress must provide it. This slice does NOT
  authenticate peers, sessions or plugins; do not expose it to an untrusted
  caller and do not accept a principal parameter from a plugin.
- Only trusted, host-registered READ-ONLY callbacks may be connected. The
  declared provider owner must match the current authority-filtered graph.
  Native callbacks run in-process, **without a sandbox**. Read-only is a
  contract, not a technical containment guarantee.
- Immediately before a callback, the host checks current graph revision,
  principal visibility and pinned owner. Immediately after the callback it
  checks again; if revoked mid-call, returns a stale revision with **no result
  bytes released**. This does NOT undo side effects or stop an uncooperative
  callback. Therefore mutating actions are *explicitly not admitted*.
- 8192-byte maximum request, 4096-byte scratch response, rejected malformed
  callback lengths, no automatic retries. The scratch reply is only published
  after success and reauthorization.
- Explicit unregister returns Busy if a callback is in flight, preventing
  premature release of caller-owned provider context. The host must also
  outlive all dispatch calls; true dynamic DLL unload is not tested here.
- Cancellation is cooperative and checked before dispatch and after callback.
  There is no preemption, wall-clock deadline, process isolation, audit receipt,
  durable grant, or cross-process lease in this revision.

## Acceptance evidence

`cmake -S native/kernel-abi -B build -DCMAKE_BUILD_TYPE=Release`

`cmake --build build --config Release`

`ctest --test-dir build -C Release --output-on-failure`

The test matrix now contains N0 ABI C11 consumer, N1 graph CAS/revocation and
N2a native dispatcher with a C11 provider callback. Negative tests: invalid
registration, duplicate ID, denied principal, stale revision, oversized input,
cooperative cancellation, wrong owner, malformed reply, in-flight unregister
and revoke-while-running with zero output disclosure.

Also require Linux/Windows native ABI GitHub Actions, architecture, SDK and
CodeMap workflow checks on the pinned PR head, independent peer QA, signed
Lifecycle and deployment readback before treating any component as installed.

## Follow-up N2b and N3

N2b must add authenticated host admission, per-session expiry and quotas,
strict typed capability/action schema, verified provider package identity,
durable operations with fenced side-effect ownership and independent receipts.
A separately loadable legacy Node MAS IPC adapter comes afterward, with
`native-only`, `native+one legacy MAS` and `legacy-only` regression tests.
Keep old Core intact and the native-only build free of Node.js dependencies.
