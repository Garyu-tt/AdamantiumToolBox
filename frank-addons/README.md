# Frank Addons — isolated polyglot addon source

Frank Addons do not share the classic bundled MAS "apps/" directory
or the signed external "plugins/" store. This third source is reserved for
language-classified packages mediated through Frankenstein Bridge.

    frank-addons/
      bridge/                   # Frank-only discovery and contract
      <language>/
        <addon-id>/
          frank-addon.json      # package metadata
          <entry>               # native language entry point
          modules/              # recursively nested components as needed

Language directories are created on demand. Neither the microkernel nor
the Frank catalog contains a fixed list of languages. Package identity is
"frank.<language>.<addon-id>", so identical addon names across different
languages cannot collide.

A minimal hypothetical package manifest:

    {
      "schema": "frank-addon-1",
      "id": "example",
      "language": "python",
      "name": "Example",
      "version": "0.1.0",
      "entry": "main.py",
      "adapter": "frankenstein.adapter.python",
      "lifecycle": "independent",
      "permissions": []
    }

The adapter value names a capability to discover and authorize, not an
executable command, URL or implicit permission. This example does not
provide an installed adapter.

## Bridge boundary

1. Discovery via bridge/catalog.mjs is read-only. Discovering a package
   never executes code.
2. Before activation, validate adapter provider, signature/hash, version,
   permissions and confined entry point against owner policy.
3. Independently approved language adapters translate lifecycle, health,
   graph and action invocations to standard MAS contracts.
4. GraphOS sees only healthy, currently permitted capabilities; the
   language does not enter the core ABI.
5. Frank packages use a separate activation registry and lifecycle;
   the classic MAS plugins/active.json registry must remain untouched.
6. If bridge or language adapter is absent, Frank capabilities disappear
   without affecting classic MAS applications.
7. Do not call an adapter sandboxed until OS-level sandboxing exists.

## Implementation status

Implemented: isolated directory, manifest validation, read-only dynamic
language/package discovery and tests. Not implemented: executable language
adapters, approval/activation registry, signature verification for Frank
packages or automatic MAS graph registration. The existing classic
loader remains unchanged.
