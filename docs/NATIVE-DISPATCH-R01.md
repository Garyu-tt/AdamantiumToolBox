# Native N2a: host-internal guarded dispatch

**Status:** Source-only experimental increment on #135/#134, not deployed.

The C++17 dispatcher is an OPTIONAL internal native-host library, not an ABI
extension, plugin installer, network service, authentication implementation,
or replacement for JavaScript MAS Core. It depends on the headless N1 graph
and C++ standard library only. Qt, Node, CppMicroServices and Wayfire remain
optional and absent from the native-only CTest target.

## Trust/authority boundary

A **trusted host** must supply the authenticated `verified_principal` from an
authenticated transport or local session; it must NOT be copied from a plugin's
request body. The host separately supplies the `host_authorize_` policy
callback, which must check the exact principal, action, current scopes,
expiry and any budget. The callback is not an authentication provider.

The N1 graph contains host-supplied *visibility* metadata. The dispatcher
requires both graph visibility and a fresh host policy permission before
calling a trusted in-process handler. It validates the binding's action,
owner and declared contract against the current graph twice before the
call. Authorization alone does not register a plugin or authorize external
side effects.

The input/output cap is 64 KiB, response bytes are staged and copied to the
caller only on success. Invalid/rejected/failed/cancelled operations return
zero bytes without altering caller output. Unbind disables captured bindings
as well as removing them from the registry.

## Deliberate limits

- `NativeDispatcher::invoke` is **host-only C++**, not a stable C plugin ABI
  or a transport/wire contract. A plugin cannot safely invoke this API directly.
- The C++ handler runs in-process and is assumed **trusted**. A hostile handler
  can corrupt memory or hang forever; no watchdog, sandbox or hard timeout
  exists in this stage. Cancel is cooperative.
- Revocation/disable checks fence normal admission and output publication;
  already-running external side effects are **not rolled back**. A real
  executor must separately enforce leased ownership, fencing tokens,
  idempotent outbox, and cancellation/deadlines at its own commit boundary.
- A caller-supplied principal string is not proof of identity; do not expose
  this class on an unauthenticated endpoint.
- N2b still requires a versioned C ABI dispatch boundary and an independently
  tested Legacy MAS compatibility adapter with explicit session authentication,
  typed envelopes, error mapping, and integration tests.
- No production signing, Lifecycle, target deployment or persistence is done.

## Acceptance

Build/test `native/kernel-abi` in Release on Linux/Windows. CTest must pass
N0 C ABI, N1 graph and N2a dispatch. Adversarial tests include forged owner
or contract, denied and unknown principals, stale revisions, grant revocation
mid-policy, unbind mid-policy, invalid/oversized input, cancellation, exceptions
and output-limit rejection. Require independent peer QA on exact head SHA.

Tracking #133, #103 and PR #57 decomposition. This is **not** the new native
microkernel launch or authorization-complete distributed runtime.
