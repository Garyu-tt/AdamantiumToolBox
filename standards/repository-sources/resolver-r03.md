# Private Source Resolver — public R03 capability contract

**Status:** public client contract and data-only parser; **not** an installed private provider. Private implementation is reviewed separately inside `AdamantezTolls`. This public document deliberately contains no private source, credentials, server hostnames, protected paths or private index.

## Discovery

A registry descriptor may advertise the semantic capability `source.resolve`.
The independent MAS plugin currently under private review uses
`source-resolver.resolve` and `source-resolver.stage` actions, with respective
host capabilities `source.resolve` and `source.stage`. Treat these as versioned
interface bindings discovered from the **actual authorized graph**; do not
hardcode the private provider's installation, clone URL or branch into Core.

This feature does not add any runtime routes to the public microkernel and does
not automatically install an optional private provider.

## Response envelope

An authorized result from a remote MAS action can be:

```json
{"result":{"allowed":true,"artifact":{
 "id":"demo.plugin","version":"0.1.0",
 "sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 "bytes":20
}}}
```

Staging uses a **different capability** and a separately scoped signed grant:

```json
{"result":{"allowed":true,
 "artifact_ref":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 "bytes":20}}
```

A denied action returns `{"result":{"allowed":false}}`. No raw file contents,
working-directory paths, private repository refs, signing keys or session state
are part of these result schemas.

The public `sdk/source-resolver-result.mjs` exports
`normalizeSourceResult(kind, response)` with `kind='resolve'|'stage'`.
It accepts only the strict safe shapes above; malformed, extra-field or denied
responses normalize to `{available:false}`. This parser is **NOT** an
authorization or signature verifier; the private service must enforce permissions
and verify signatures at point of use. Unknown providers must remain unavailable.

## Limits

The private prototype uses at most 128 KiB single-file artifacts from a trusted
local content-addressed store. It does not clone a Git repository, enumerate
private branches, mount agent workspaces, issue private credentials or deploy code.
Local staging requires a protected OS directory and does not itself authorize
other processes to read staged bytes. Production requires per-service identity,
authenticated agent binding, replay protection, an independent Workspace Manager,
auditing, release signing and safe rollback.

No change to the existing five peer automations, roles or schedules is needed.
See [R01 source boundary](../../docs/ADAMANTEZ-SOURCE-BOUNDARY-R01.md).
