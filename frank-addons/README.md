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
  <language>/<addon-id>/
    frank-addon.json       # package manifest
    <entry>                # language entry
    modules/...            # recursive submodules
apps/frankenstein/         # optional MAS gateway, NOT Frank package storage
```

The language-independent ABI is specified by
[FRANK-ADAPTER-1](../standards/FRANK-ADAPTER-1.md). Both Python and
JavaScript implement it. Neither is required by the microkernel.
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
See [Python provider](bridge/providers/python/README.md) or
[JavaScript provider](bridge/providers/javascript/README.md) for startup.
Only approved, intact packages with a healthy provider appear in MAS as
`frankenstein.<language>.<addon-id>.<action>`.
The package identity remains `frank.<language>.<addon-id>`.

## Security limits

- Approval pins a local SHA-256 of all files, including nested modules.
  Changes revoke visibility until reapproval.
- Neither signatures nor sandboxed execution of arbitrary hostile code are
  production-ready. No unsigned remote automatic activation.
- Python uses Linux namespaces and Python resource limits. JavaScript uses
  Linux namespaces and Node's V8 heap cap. Missing Bubblewrap means execution
  is disabled, never silently downgraded.
- Bridge-wide `frankenstein.invoke` is coarse: only packages with
  `permissions: []` can currently be approved. Per-action grants remain TODO.
- Classic MAS loader and its registries remain independent; removing the
  Bridge does not affect classic plugins.
