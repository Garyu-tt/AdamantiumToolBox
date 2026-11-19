# SDK v0.1 — additive MAS 1.0 authoring layer

This SDK extends the existing MAS 1.0 contract without changing Core or
requiring SDK code at application runtime. Do not replace `core/contract.mjs`,
`core/catalog.mjs`, the signed lifecycle, the existing code map or Raw UI.

## Generate a standalone draft

    node tools/new-app.mjs thermometer --port 9302 --name Thermometer

The port is an explicit deployment input (MAS 1.0 still requires a manifest
port). No port is baked into Core. The generator **never promotes drafts**:
review `drafts/<id>`, run tests, provide a suitable icon and explicitly copy
it to `apps/<id>` or package it via signed lifecycle. Existing directories fail.
The generated runtime uses only Node standard modules, the app files and Core.

## Sidecar `mas-modules-1`

`modules.json` augments `manifest.json`, without claiming MAS 1.0 reads it.
A module declares `id`, `kind`, `version`, `enabled`, `provides`, `consumes`,
`links` and optional `children`. Children may nest recursively. Every provided
capability is namespaced to its owning app and has `type`, `title`, semantic
`version` and `permissions`; actions also declare input/output shape metadata.
External dependencies must have `optional: true` so Core + App remains viable.
Required local dependencies deactivate only the dependent capability when absent.
`^MAJOR.MINOR.PATCH` and exact versions are supported; no broader semver ranges.

`sdk/modules.mjs` validates documents; `sdk/graph.mjs` computes MAS 1.0-compatible
graphs and dependency negotiation. The generator packages these two files with
each application under `runtime/`, so no SDK installation or Core import is
needed at runtime. It reads `modules.json` on every graph/invoke request,
validates the document, rejects dependency cycles and incompatible required
local dependencies, and hides disabled modules with their descendants.
Malformed modules fail closed; missing active action handlers invalidate the graph.
**C03:** generated actions now validate input before handler execution and
output before response using a strict JSON Schema subset; see
`docs/TYPED-CAPABILITY.md`. Existing MAS 1.0 applications remain untouched.
**Limitations:** there is no live cross-app provider subscription, persistent
module-state transaction, full JSON Schema support or automatic migration.

## Existing integration / acceptance

- `/health`, `/graph`, `/invoke`: existing Core contracts, not a new broker.
- `/api/graph` and `/api/navigation`: existing live discovery and Raw UI.
- Existing shell refreshes every 12 s; event push is a separate small change.
- Existing `tools/codemap_graph.py` returns SHA-pinned context packs. Obtain
  full `source` and confirm SHA before changing any existing file.
- Run `node tests/sdk_modules.test.mjs`, `node tests/sdk_scaffold.test.mjs`,
  `node tests/isolation.test.mjs`, architecture scan and all repository CI tests.

## Next compatibility gates

1. Replace hard-required manifest ports with a versioned dynamic listener adapter.
2. Add central typed invocation validation, schema version negotiation, denial
   evidence and independent permission checks, without invalidating MAS 1.0.
3. Emit authorized graph-change events and make shell subscribe with poll fallback.
4. Validate live module toggles under actual supervisor recovery and signed bundles.
5. Extend CodeGraph with manifest relations and diff-aware context budgets.
