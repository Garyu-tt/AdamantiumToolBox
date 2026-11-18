# Frank Addons — isolated polyglot plugins

Packages are located only in `frank-addons/<language>/<addon-id>/`.
The classic MAS `apps/` and `plugins/` catalogs are unchanged. Language
directories are created dynamically; recursive `modules/` are supported.

```text
frank-addons/
  bridge/                  # independent source, approval and routing
    providers/python/      # optional sandboxed Python execution service
  <language>/<addon-id>/
    frank-addon.json       # package manifest
    <entry>                # language entry
    modules/...            # recursive submodules
apps/frankenstein/         # optional MAS gateway, NOT Frank package storage
```

Example `frank-addon.json`:
```json
{
 "schema":"frank-addon-1", "id":"hello", "language":"python",
 "name":"Hello", "version":"0.1.0", "entry":"main.py",
 "adapter":"frankenstein.adapter.python", "lifecycle":"independent",
 "permissions":[], "actions":[{"id":"echo","title":"Echo"}]
}
```

Actions appear in MAS as `frankenstein.<language>.<addon>.<action>`.
The package identity stays `frank.<language>.<addon>`. The optional MAS
Frankenstein application is only a gateway; packages never join the
classic MAS application catalog or signed plugin activation registry.

## Approval workflow

Provide a private `ADA_FRANK_STATE_DIR` or use the existing
`LOCALAPPDATA/Adamantium Toolbox/frank` on Windows or
`XDG_STATE_HOME/adamantium-toolbox/frank` on Linux.

```sh
node frank-addons/bridge/manage.mjs status
node frank-addons/bridge/manage.mjs adapter frankenstein.adapter.python 9100 --approve
node frank-addons/bridge/manage.mjs plan frank.python.hello
node frank-addons/bridge/manage.mjs approve frank.python.hello --approve
node frank-addons/bridge/manage.mjs disable frank.python.hello --approve
```

Python now has an **experimental Linux-only** Bubblewrap provider:
see [Python adapter](bridge/providers/python/README.md) for prerequisites,
startup commands and fail-closed behavior. Other languages still need their
own registered adapters. The Python provider is not an unrestricted host
Python runner, and it does not automatically start or approve itself.
The bridge dynamically detects approved, healthy adapters and exposes only
their intact approved packages. No code executes during discovery.

## Security limits

- Approval pins SHA-256 of **all** files, including recursive modules.
  Any change revokes visibility until explicit reapproval.
- This is local owner approval, **not signed publisher provenance**.
- Python uses OS namespaces when Bubblewrap is available; absent on Windows
  or restricted Linux hosts, the provider does not execute unisolated code.
  Seccomp, cgroup PIDs, separate identities and signed releases are still absent.
- Bridge-wide `frankenstein.invoke` scope is coarse. Until per-addon/per-user
  scopes are implemented, only packages with `permissions: []` can be approved.
- The bridge app is optional. Removing it never breaks classical MAS apps.
- Tests: `node tests/frank_addons.test.mjs`,
  `node tests/frank_bridge.test.mjs`, `node tests/frank_python.test.mjs`.
