# Adamantium MCP Bridge, MAS plugin 0.1.0

## Current scope

This is one independent MAS application under `apps/mcp_bridge`. It requires **Core + this app only** and no other optional app. It runs on the machine hosting the Adamantium runtime; it is not a new centralized orchestrator. Read-only network discovery, dynamic capability routing and explicit invocations use Adamantium's existing `/api/graph` and `/api/invoke` contract.

MCP tool names are stable across ChatGPT model versions:

- `adamantium_nodes`: approved logical nodes and observed reachability
- `adamantium_capabilities`: current graph from all or one node
- `adamantium_invoke`: exact `{node_id, action, params}`; refuses undeclared/unapproved actions

Browser automation, editors, CMS and any future MAS app are **not hardcoded**: if they expose actions in the Core graph, they become discoverable. Calls require operator-configured exact action allowlists AND each node's native permissions. This is not a universal shell and not a bridge to unrestricted execution.

## Deployment (not performed)

The gateway binds only `127.0.0.1` and requires independent strong `ADA_MCP_BEARER`, internal MAS key and node credentials. Use an operator-managed HTTPS reverse proxy with authentication, access controls and stable service DNS. A *real* remote endpoint must be verified before adding `mcp.json` to a ChatGPT plugin. There is NO production endpoint or DNS name hardcoded in this package.

Environment inputs:

- `ADA_INTERNAL_KEY`: same key used by the local MAS Core
- `ADA_MCP_BEARER`: independently generated long random token for this gateway, not stored in source
- `ADA_BRIDGE_CONFIG`: path to operator-controlled trusted node registry JSON, hot-reloaded each request
- `ADA_CORE_URL` and `ADA_TOKEN`: local Core bootstrap (only when registry absent), no arbitrary remote fallback
- `APP_PORT`: runtime-assigned listener, default from `manifest.json`

Example of a **configuration template, not live addresses**:

```json
{
  "schema": "adamantium.bridge.nodes.v1",
  "nodes": [
    {
      "id": "logical-machine-a",
      "approved": true,
      "urls": ["https://REAL-OPERATOR-VERIFIED-ENDPOINT/"],
      "tokenEnv": "ADA_NODE_A_TOKEN",
      "allow": ["browser.tabs", "browser.screenshot"]
    }
  ]
}
```

The registry is reloaded on each request. The same node ID can map to a new endpoint after migration without changes to the MCP tool schema or ChatGPT plugin code. Node IDs must match the MAS ID restrictions (use `node_a`, not example placeholders with embedded URLs). Backend code is independent of the ChatGPT model version. The bridge currently uses a **manually trusted operator registry**: it does not yet verify signed Mesh membership, and DNS/HTTPS validation and policy are the operator's responsibility. Do not auto-enroll untrusted nodes.

## Failure and migration semantics

The graph is retrieved from all configured nodes without assuming their availability. Missing nodes are reported as `unreachable`, not silently omitted. A logical node can have multiple trusted endpoints. Discovery can try the next configured endpoint after a read-only failure; **mutating `adamantium_invoke` is NEVER retried automatically after POST**. HTTP errors and timeouts can represent an uncertain commit. Require idempotent task IDs and an independent status check before replaying remote operations in a future protocol revision.

This does **not** turn the existing signed-package Mesh into a distributed capability router. The current repo describes that as a future task, not something deployed. Full cross-node mobility needs signed node identity, certificate pinning or trusted identity federation, distributed service discovery/leases, replication, stable HTTPS ingress with independent gateways, and per-node authorization/observability. No single control node can be guaranteed available without that work.

## Chromium browser integration

The existing MAS Browser plugin exposes `browser.tabs`, `browser.open`, `browser.navigate`, `browser.click`, `browser.type`, and other capability IDs. These can be routed without importing Browser from the MCP plugin. Browser's current profiles are temporary and **do not preserve logins across nodes**. Session portability requires a separately designed encrypted profile and secrets manager; do not copy raw passwords, cookies or OS-bound encryption material over the mesh.

## Acceptance

Run `node --test tests/mcp_bridge*.test.mjs`. The tests launch a real standalone MCP Bridge service with mock Core APIs on independent ports and cover two nodes, policy denial, hot-reload after migration, MCP `initialize`, `tools/list` and `tools/call`. Full Core + App integration and cross-node production routing must still be checked in the actual Windows runtime before activation. Respect `docs/ADR-0001-ARCHITECTURE.md` and the 120-line/6144-byte file budget. Do not activate or distribute unsigned packages automatically.
