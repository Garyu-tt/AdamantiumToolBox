# Workspace Manager R04 — public, metadata-only interface

**Status:** independent public interface only. The experimental private implementation
lives in `AdamantezTolls` and is not activated by this document or SDK.
The open Toolbox core, app discovery and five peer automation settings remain unchanged.

## Capability discovery

A permitted private provider may declare these MAS actions:

| Action node | Host capability | Semantic purpose |
|---|---|---|
| `workspace-manager.prepare` | `workspace.prepare` | Prepare a verified source artifact in one task workspace |
| `workspace-manager.revoke` | `workspace.revoke` | Remove one previously prepared task workspace |

Each action requires a separately signed grant with `grant.subject` matching the
requested agent. Grant `resource` is the exact
`private:<artifact_id>:<agent_id>:<task_id>` tuple. Actions must enforce
these grants at the private server. The agent ID and task ID must never be
accepted as authorization merely because they appear in an API request.

## No source access through this public interface

Successful preparation returns only:

```json
{"result":{"allowed":true,
 "workspace_ref":"workspace:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 "sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
 "bytes":128}}
```

Successful revocation returns only:

```json
{"result":{"allowed":true,"revoked":true,
 "workspace_ref":"workspace:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}
```

All denials return `{"result":{"allowed":false}}`.

The public `sdk/workspace-result.mjs` implements
`normalizeWorkspaceResult('prepare'|'revoke', envelope)` and strictly
rejects unexpected fields. It is a UI/client data parser, **not** a security
enforcer. It never handles raw code, private file paths, session tokens,
production credentials or privileged installer configuration.

`workspace_ref` is an opaque **label, not a bearer credential**.
It does not identify an endpoint and does not authorize a process to read
source. A future independent Agent Runner Broker must authenticate the
agent by its own OS or workload identity and enforce isolation at the
point of workspace access.

## Limitations of current private R04 prototype

R04 verifies local signed grants and provides owner-private directories, but
different agents running under the same OS UID are **not isolated** from
one another. Its nonce ledger is local rather than multi-node, its host key
is a shared prototype transport credential, and it has no production
runner, secure namespace broker, egress DLP, distributed audit, or
privileged delivery service. Do not claim production security or actual
agent handoff based on a passing CI test.

Related: [R03 source resolver contract](resolver-r03.md),
[R01 public-private boundary](../../docs/ADAMANTEZ-SOURCE-BOUNDARY-R01.md).
