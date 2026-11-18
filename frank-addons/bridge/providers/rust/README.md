# Rust Frank Addon adapter (experimental, Linux)

This is a separate `frankenstein.adapter.rust` provider, not a mandatory
Core dependency. Source files remain in `frank-addons/rust/<id>/` and are
not mixed with classical MAS plugins.

## Execution
The adapter discovers the trusted Rust toolchain using `rustc --print
sysroot`, mounts the resolved toolchain read-only into a Linux Bubblewrap
namespace, compiles an approved `.rs` entry to `/tmp/frank-executable`,
then executes the binary **inside the same network-unshared sandbox**.
There is **no host-side Rust compilation of addon source** and no
unisolated fallback. Rust toolchain, linker and Bubblewrap must be
available. This first profile supports rustc and standard-library source,
including recursive `mod` files. Cargo/dependency fetching is disabled.
The `main.rs` program reads one JSON request on stdin and emits a
single JSON result `{"result": ...}` to stdout.

## Operator setup
Set `ADA_FRANK_STATE_DIR`, `ADA_INTERNAL_KEY`, and
`FRANK_ADAPTER_PORT` via the owner-private environment. Example:

```sh
export FRANK_ADAPTER_PORT=9102
node frank-addons/bridge/providers/rust/service.mjs
# In another shell with the same private registry and secret:
node frank-addons/bridge/manage.mjs adapter frankenstein.adapter.rust 9102 --approve
node frank-addons/bridge/manage.mjs plan frank.rust.hello
node frank-addons/bridge/manage.mjs approve frank.rust.hello --approve
```

The sample Rust Hello forwards the `params` field from the strict Bridge
JSON frame, including Unicode and nested structures. Its helper is
intentionally **not** a reusable JSON parser; production packages should
bundle a real JSON codec and review dependencies. Bridge registers only
healthy, owner-approved, hash-intact packages with empty permission
scopes.

## Limits
The sandbox is not a hardened arbitrary-code service: no cgroup memory
or PIDs budgets, seccomp policy, distinct addon OS identities, signed
release provenance, or immutable content store. The toolchain is trusted
and the host system directories mapped by the shared worker are readable.
Do not activate unknown third-party Rust code. Windows runtime unsupported.
