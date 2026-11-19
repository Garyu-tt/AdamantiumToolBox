# Runner Broker R05a — optional public admission-preview contract

**Status: experimental, preview-only.** This public interface contains no
private source, agent signing keys, worker trust store, paths, server addresses,
executors or production settings. The private MAS implementation is in the
separate, access-controlled `AdamantezTolls` repository (R05a private PR).

## Capability

A real, authorized private provider may expose:

- MAS action: `runner-broker.preview`
- Host permission: `runner.preview`
- Signed grant action: `runner.preview`
- Signed grant resource: `private:<artifact_id>:<agent_id>:<task_id>`

The provider validates both a short-lived operator-signed grant and a
**separate** short-lived proof signed with the agent-specific Ed25519 key.
This is a preview, **not** authenticated process execution. Signature
verification, proof freshness, local workspace integrity and access control
must be performed server-side. The public parser does none of those things.

## Safe result shape

```json
{"result":{
  "eligible":true,
  "runnable":false,
  "reason":"isolation_unavailable",
  "workspace_ref":"workspace:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "bytes":52,
  "budget":{"timeout_ms":1200,"memory_mib":64,"cpu_percent":20,"network":"deny"}
}}
```

The requested CPU/RAM/time bounds are **validated, not enforced**, because no
workload is executed. Any `runnable:true` response is explicitly rejected by
this R05a parser. This prevents an unimplemented backend from accidentally
being presented as an executable capability. A denied response is

```json
{"result":{"eligible":false,"runnable":false,"reason":"unavailable"}}
```

`sdk/runner-admission-result.mjs` exports `normalizeRunnerPreview(response)`.
It accepts only the strict metadata-only shape and otherwise returns
`{eligible:false,runnable:false}`. It never grants access to a workspace or
returns sensitive fields.

## Required next phase

R05b must prove **actual per-agent OS isolation**, point-of-use attestation,
one-time durable claims, enforced resource/network restrictions and process
revoke/kill. Worker proofs remain replayable during their short validity
window in R05a. Do not infer production readiness or safe execution from a
successful preview, and never treat `workspace_ref` as a bearer token.

R05a does not modify the Toolbox microkernel, install a server service, enable
any workflow execution or change the five developer bot settings.
Related: [R04](workspace-r04.md), [R03](resolver-r03.md).
