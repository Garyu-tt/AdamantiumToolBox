# Native graph N1 — atomic, principal-filtered snapshot store

Status: SOURCE-ONLY, independent acceptance required. Tracks #133 and N0 PR #134.

The native graph is an isolated C++17 static library with no Node.js, Qt,
CppMicroServices, Wayfire, mesh transport, or operating-system specific API.
It accepts a **complete snapshot from an already trusted host authority**, then
provides consistent revision-filtered capability views to local host code.

## Contract

- An authority-provided snapshot contains a strictly monotonic local source
  epoch, unique capability IDs with owning plugin/contract, and explicit
  principal-to-capability visibility bindings.
- reconcile(expected_revision, snapshot) is CAS-protected. Invalid IDs,
  duplicate capabilities or grants, orphan grants and over-budget data reject
  without mutation. A stale source epoch, replay or conflicting writer rejects.
- Each accepted snapshot increments revision, **even when content is unchanged**,
  fencing prior view tokens. Diff includes add/modify/remove/grant/revoke events.
- resolve(principal,id,expected_revision) and project read atomically;
  stale revisions return no capabilities, unknown principals have no visibility.
- There is no action invoke/export API in this increment. A granted visibility
  binding is **not** permission to execute; the future native dispatcher must
  revalidate the authenticated principal, provider identity, current revision,
  action-specific scope, expiration and policy immediately at the use boundary.
- source_epoch is only a local in-process freshness guard: **not** signed,
  persisted, cross-node fencing or a cryptographic proof. The caller must
  authenticate and validate the source externally before reconcile.
- The library allocates and retains its state in-process; this stage does not
  persist grants, issue signed delivery receipts or install onto any host.

## Acceptance

cmake -S native/kernel-abi -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure

Tests cover hidden principal projections, denial, revocation, stale CAS,
replay protection, invalid/oversize input and same-revision racing writers.
The existing C11 ABI consumer must also continue to pass unchanged.
Compile on both Linux GCC and Windows MSVC via the inherited native-kernel-abi
workflow before independent review. The C++ graph is **not** exported through
N0's stable C ABI; N2 must introduce a separately versioned safe graph/provider
facade rather than adding C++ methods to the public plugin boundary.
