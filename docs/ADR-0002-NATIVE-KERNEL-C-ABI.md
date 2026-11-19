# ADR-0002: Native host ABI without permanent JavaScript or GUI coupling

Status: PROPOSED (PR review, not a production cutover). Tracking: #133, #120, #48.

## Decision
C++17 is the target implementation for the small MAS host. Plugin interfaces
must have a versioned, language-neutral C ABI with opaque handles. No exception,
STL container, C++ name mangling, Qt object, JavaScript object, or operating
system-specific handle crosses the boundary. Any richer provider is optional.

The first **N0** increment intentionally implements only a host-handle lifecycle,
version negotiation and C-caller test. It is not a capability graph, service
registry, authorization engine, runnable agent, replacement for Node.js Core,
or installed host daemon. No source in this increment changes `core/*.mjs`.

## ABI v1 lifecycle
- Call exported `mas_host_get_api_v1` with exact requested ABI and table size.
- The host fills the caller-owned function table only after successful negotiation.
- `create` validates the version, struct size, and reserved fields; the library
  allocates the opaque host handle, freed only by its matching `destroy`.
- The caller may start, stop and restart a host; state-changing calls return
  `MAS_ERR_STATE` for invalid transitions and increment generation on start.
- Snapshot writes require caller-owned exact-size storage. The host does not
  expose pointers to its internal state or transfer memory ownership to callers.
- `destroy` must not race outstanding API calls; callers own the lifetime boundary.
  `start`/`stop`/`snapshot` serialize with a mutex. This is not thread fencing
  for future external side effects.
- No plugin invocation exists in this revision; no authorization is implied by
  acquiring an API table or observing state. The intended N1 work must require
  scoped identity, fresh permission checks, revocation and generation fencing.
- Unsupported minor versions intentionally fail closed until an explicit
  compatibility rule and conformance suite are accepted.

## Test and next gates
- Build shared library in Linux and Windows; compile test consumer as **C11**
  and link against the C++ library to prove the public ABI is C-compatible.
- Test ABI mismatch, invalid sizes, reserved configuration, transition errors,
  restart generation, snapshot and nullptr handling; this is a basic fixture,
  not independent security assurance.
- N1: authority-filtered capability graph and negative authorization tests.
- N2: separate versioned legacy Node MAS adapter, plus native-only boot tests.
- N3: platform lifecycle adapters, then permissioned Android NDK process tests.
- Never make CppMicroServices, Qt6, Wayfire, Node, Mesh, or private Adamantez
  required for loading this N0 host library.

## Evidence policy
A successful PR CI is only a source verification signal. Require independent
review, exact-head checks, signed Lifecycle and authorized deployment readback
before announcing an installed runtime or replacing the current Core.
