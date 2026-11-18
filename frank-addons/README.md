# Frank Addons — isolated polyglot plugins

Packages are located only in `frank-addons/<language>/<addon-id>/`.
The classic MAS `apps/` and `plugins/` catalogs are unchanged. Language
directories are created dynamically; recursive `modules/` are supported.

```text
frank-addons/
  bridge/                  # independent source, approval and routing
    providers/shared/      # reusable auth, sandbox and HTTP lifecycle
    providers/python/      # optional Python executor
    providers/javascript/  # optional JavaScript/Node executor
    providers/rust/        # optional Rust source compiler + executor
  <language>/<addon-id>/
    frank-addon.json       # package manifest
    <entry>                # language entry
    modules/...            # recursive submodules
apps/frankenstein/         # optional MAS gateway, NOT Frank package storage
```

The language-independent ABI is specified by
[FRANK-ADAPTER-1](../standards/FRANK-ADAPTER-1.md). Python, JavaScript,
and Rust implement it. Neither is required by the microkernel.
The bridge discovers languages from declared package capabilities and
operator-approved adapter registrations, not a fixed list.

## Approval workflow

Use an owner-private `ADA_FRANK_STATE_DIR`, or the existing
`LOCALAPPDATA/Adamantium Toolbox/frank` on Windows /
`XDG_STATE_HOME/adamantium-toolbox/frank` on Linux.

```sh
node frank-addons/bridge/manage.mjs status
node frank-addons/bridge/manage.mjs adapter frankenstein.adapter.javascript 9101 --approve
node frank-addons/bridge/manage.mjs plan frank.javascript.hello
node frank-addons/bridge/manage.mjs approve frank.javascript.hello --approve
node frank-addons/bridge/manage.mjs disable frank.javascript.hello --approve
```

Adapter registration does not install an interpreter or start its process.
See [Python provider](bridge/providers/python/README.md),
[JavaScript provider](bridge/providers/javascript/README.md), or
[Rust provider](bridge/providers/rust/README.md) for startup.
Only approved, intact packages with a healthy provider appear in MAS as
`frankenstein.<language>.<addon-id>.<action>`.
The package identity remains `frank.<language>.<addon-id>`.

## Security limits

- Approval pins a local SHA-256 of all files, including nested modules.
  Changes revoke visibility until reapproval.
- Neither signatures nor sandboxed execution of arbitrary hostile code are
  production-ready. No unsigned remote automatic activation.
- Python uses Linux namespaces and Python resource limits. JavaScript uses
  Linux namespaces and Node's V8 heap cap. Rust source is compiled and
  executed inside a network-unshared namespace with resource/time limits. Missing Bubblewrap means execution
  is disabled, never silently downgraded.
- Bridge-wide `frankenstein.invoke` is coarse: only packages with
  `permissions: []` can currently be approved. Per-action grants remain TODO.
- Classic MAS loader and its registries remain independent; removing the
  Bridge does not affect classic plugins.

## FRANK-VALUES-1 and pipeline

The bridge implements [FRANK-VALUES-1](../standards/FRANK-VALUES-1.md).
Ordinary JSON values remain interoperable. Exact 64-bit integers and bytes
are explicitly tagged, so adapters do not silently round them.
A live `frankenstein.pipe` capability supports one-hop composition between
two approved addon actions, revalidating the destination before calling it.
Use `{"from":"frankenstein.python.hello.echo",
"to":"frankenstein.javascript.hello.echo","input":{"message":"Hi"}}`.
The target receives `{"input":<source-result>}`. No arbitrary command
execution, auto-activation, or permanent workflow scheduler is provided.
