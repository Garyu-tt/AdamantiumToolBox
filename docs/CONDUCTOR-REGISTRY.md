# Conductor Registry R01 — source reconciliation, not MAS lifecycle

This developer-only, read-only tool implements the first slice of #24. It **does not**
install, load, authorize, activate, disable, merge, or start any plugin. It does not
replace `core/catalog.mjs`, the signed Lifecycle, or runtime capability discovery.

## Usage

```sh
node --test tests/conductor_registry.test.mjs
node tools/conductor-registry.mjs --root . --out ./registry-output \
  --source-type repository_checkout --ref main
```

To compare snapshots from the same source lineage:

```sh
node tools/conductor-registry.mjs --root . --out ./next-registry \
  --previous ./registry-output/registry.json --ref main
```

Optional: `--uri <origin>`, `--at <ISO8601>`, `--source-type git_pr`,
`--observations <json>`, `--previous-observations <json>`,
`--max-age-minutes <nonnegative number>`. Pass an explicit source ref and URI
from the caller's actual checkout, PR or archive; the scanner cannot verify
Git refs or remote provenance on its own. Never infer a merge from a PR snapshot.

## Outputs

- `registry.json`: each discovered MAS 1.0 `manifest.json` or Frank
  `frank-addon-1` `frank-addon.json` is a separate record, with stable `mas:<id>`
  and `frank:<language>:<id>` identities, file SHA-256, field source, and source type.
- `reconciliation.json`: duplicates, declared capability claim overlaps, port
  conflicts, added/changed/absent-from-scanned-source records, and separately
  labelled **unverified** runtime signals.

`permissions` are *permission requirements*, **not** runtime capability nodes.
`capabilities` are claims only when explicitly present in a source manifest.
`dependencies` and `requirements` are recorded separately. An absent manifest
is not evidence that a running plugin was uninstalled. A syntactically parsed
manifest is `structural_only`; Core is authoritative for MAS contract validation.

## Runtime observations (untrusted input)

```json
{
  "observed_at":"2026-11-18T19:00:00Z",
  "source":{"kind":"manual_export","ref":"capture-id"},
  "apps":[{"uid":"mas:browser","state":"running","node":"node-1",
           "capabilities":["browser.view"]}]
}
```

The output sets `verified_by_registry:false` **regardless of reported state**.
`--max-age-minutes` classifies freshness of the timestamp, not identity or
trust. Only an authenticated, pinned, policy-authorized MAS graph adapter can
later promote a runtime claim into verified state. The registry never calls
YodaBR shell or attempts to guess deployment targets.

## Known limitations and next slice

R01 cannot prove a Git commit/ref from disk alone, validate code-map ownership,
inspect recursively nested submodule manifests, or independently verify signed
runtime observations. Future changes should add typed adapters and change
propagation over real MAS capability events, not a hardcoded app catalog.