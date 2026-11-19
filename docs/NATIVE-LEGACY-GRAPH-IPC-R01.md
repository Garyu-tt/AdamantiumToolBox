# Native N3a — optional legacy MAS graph discovery sidecar

Status: experimental source-only, NO production rollout. Stacked on #139 (which
requires #136 -> #135 -> #134). The unrelated C11 native provider bridge #138
is a separate branch. Tracks native cutover #133 and integration ledger #103.

## Verified legacy source contract

The current `core/kernel.mjs` serves authenticated `GET /api/graph`, and
`POST /api/invoke`. Its graph is an ephemeral, cap-filtered discovery view.
N3a uses **only** `GET /api/graph`; it intentionally never forwards `/invoke`.
A discovered node is **not** a valid native `AuthoritySnapshot` grant, proof
of ownership, permission to execute, or a stable graph revision. No Node code
is linked to the C++ kernel. Source registry remains independent.

## Wire protocol (local supervised stdio only)

`MASL` [4 ASCII bytes] | version [u16 big-endian = 1] | opcode [u16 BE] |
request_id [u64 BE nonzero] | payload_len [u32 BE] | payload bytes.
Header = 20 bytes; payload limit = 65,536 bytes. Opcodes:
- 1 GRAPH_GET: zero-length payload. Request IDs must strictly increase per
  process lifetime to prevent same-session replay.
- 2 GRAPH_RESULT: nonempty UTF-8 JSON with exactly the adapter's discovery
  schema. Only `{id,type}` nodes and `{from,to,type}` edges survive filtering.
- 3 ERROR: bounded generic error text; never includes the token, URL or source
  server error body.

There is **no invoke/write/ack/transaction opcode**, shared-memory pointer,
plugin load, or network listener. `native/kernel-abi/src/legacy_frame.cpp` is a
pure C++17 standalone codec; the optional `native/legacy-mas-bridge/legacy_stdio.mjs`
sidecar is separately started by a trusted supervisor and communicates with
its parent on stdin/stdout. Run with required `MAS_LEGACY_CORE_URL`
(loopback HTTP root only, explicit nonprivileged port) and
`MAS_LEGACY_CORE_TOKEN` (already provisioned, minimum 24 characters).
Secrets must be injected through a secrets-aware supervisor and must never be
printed. No embedded default address, port, identity or token.

All graph fetches use a 2s timeout, `redirect: error`, explicit auth, no-store,
byte limits (wire 64 KiB, 2,048 nodes, 4,096 edges) and structural validation.
Each GRAPH_GET calls the legacy Core anew; a changed graph is visible on the
next successful request. Malformed/replayed requests and upstream failure
return a generic fail-closed error. The sidecar should not be exposed to
untrusted stdin, shell or credentials. Loopback alone is not authentication.

## Reproducible acceptance

Run `cmake -S native/kernel-abi -B build -DCMAKE_BUILD_TYPE=Release`,
`cmake --build build --config Release`, then
`ctest --test-dir build -C Release --output-on-failure`.

N0/N1/N2 tests must still pass. N3a C++ codec test runs with no Node. If Node
is found at configure time, the optional cross-language integration test
starts a disposable fake loopback MAS Core, uses the real C++ CLI to encode a
request, passes it via the sidecar, then decodes its response back in C++.
It checks graph changes, private-field stripping, denial, malformed requests
and replay rejection. This does not exercise production MAS Core, signed
Lifecycle, dynamic discovery, long-lived agent cancellation or network ACLs.

## Next acceptance gates

Independent code/security review, two-OS CI on pinned exact head, supervisor
sandbox and process-tree lifecycle, authenticated principal-to-discovery
mapping, strict N1 graph import (with a real host authority issuing grants),
full signed provider provenance, and rollback-capable Node cutover. Invocation
remains deliberately out-of-scope until per-action host authorization has a
revisioned policy lease and a fenced commit/receipt interface.
