# N2b — C11 read provider adapter for NativeDispatcher

**Status:** Source-only, experimental, not deployed. Stacked on native host
dispatcher PR #136, graph PR #135 and host C ABI PR #134; tracks #133.

## What it adds

A C-language callback contract is independently versioned under
`standards/native/mas_read_provider_v1.h`. The internal C++17 host may call
`bind_c_read_provider(dispatcher, action, owner, contract, callback, context)`.
This is the only factory entry point: it captures the **same action** used
for registration and for delivery to the C callback. It is deliberately
not a separately exported C ABI allowing arbitrary plugins to register
themselves. Actual dynamic loading and package provenance are later stages.

The callback receives exact-size versioned structures, length-delimited byte
buffers, an output buffer owned by the host and a cooperative cancellation
query. It cannot pass exceptions, allocator ownership, C++ STL objects or
OS-specific handles across the C boundary. The adapter bounds requests at
8192 bytes and reply capacity at 4096 bytes; rejects malformed C reply fields
and suppresses output on errors. The parent NativeDispatcher still owns
graph revision/owner/contract checks, the host authorization callback and
the final no-partial-output readback. No adapter-level authority is invented.

## Trust model and known limitations

- Only a trusted host calls bind, supplies an already authenticated actor,
  pins owner/contract, supplies the host policy callback and retains the
  provider context until all invocations have finished.
- This is **read-only** by contract; a native callback is in-process and
  is **not sandboxed** or technically prevented from writing outside the API.
- Revocation can reject output from an in-flight callback but cannot undo its
  side effects. Cancellation is cooperative; unresponsive code can hang.
- No dynamic shared-library unload, authenticated session/transport, per-action
  schema validation, sandbox, durable write outbox, power-loss recovery or
  deployment. Do not allow untrusted or write-capable modules on this path.

## Acceptance

Linux GCC14 Release: local CMake/CTest passed the N0 host ABI, N1 graph and
N2b adapter C11 callback (3/3). The N2a parent also requires its own test in
full GitHub CI. Independent reviewer and actual GitHub Linux/Windows CI on the
exact branch head are mandatory before any merge. Neither passing this test
nor merging source means a live native kernel cutover.

Next: explicit authenticated host session API, signed plugin provenance,
hard budgets and separate IPC bridge to legacy Node MAS with native-only
regression; owner signed Lifecycle and rollback remain distinct gates.
