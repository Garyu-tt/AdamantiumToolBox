# Adamantium MCP Bridge: signed identity and explicit cutover (MAS App 0.2.0)

## Stable client ABI

The independent `mcp_bridge` MAS App accepts only the fixed MCP operations `adamantium_nodes`, `adamantium_capabilities`, and `adamantium_invoke`. Backends determine actual apps dynamically from their Core capability graph. It requires `Core + mcp_bridge` only, with no browser, Mesh worker, optional app or specific ChatGPT model as a runtime dependency.

The returned graph contains **only currently exposed action nodes also present in the operator allowlist**. Missing permissions or stale/absent actions do not create phantom buttons. A configured node must prove its existing Mesh Ed25519 identity using authenticated, nonce-bound `GET /api/identity?challenge=<48 hex>` before its graph can be treated as reachable. The core signs `adamantium.core.identity.v1\n<mesh-uuid>\n<challenge>` with its existing Mesh private key. The bridge checks the pinned public key and the exact nonce; the private key never leaves the Core. `POST /api/invoke` additionally receives `X-Adamantium-Target-Node` and Core denies a mismatch with HTTP 409 before any action is run.

## Operator-approved registry

Registry schema remains `adamantium.bridge.nodes.v1`. The following is a structural **template**, not a real deployment. Replace all example fields with verified runtime facts without embedding credentials in the file:

```json
{
  "schema": "adamantium.bridge.nodes.v1",
  "nodes": [
    {
      "id": "logical_node",
      "approved": true,
      "urls": ["https://OPERATOR_VERIFIED_CORE_HOST/"],
      "tokenEnv": "ADA_REMOTE_CORE_TOKEN",
      "identity": {
        "id": "MESH_UUID_FROM_TRUSTED_PROVISIONING",
        "publicKey": "ED25519_SPKI_PEM_WITH_NEWLINES"
      },
      "allow": ["browser.tabs"]
    }
  ]
}
```

`identity.id` is the Mesh UUID from trusted provisioning and `identity.publicKey` is its PEM public key (not an API token). They are **pinned by the operator**, never self-enrolled from an untrusted network response. Reject unknown IDs, unexpected keys, insecure HTTP outside loopback and URL credentials. `ADA_BRIDGE_CONFIG` selects the hot-reloaded registry, while `ADA_MCP_BEARER` independently protects the localhost MCP listener. Node access tokens are separately loaded from environment variables named by `tokenEnv`, never stored in the registry or returned to ChatGPT.

The Core identity state uses the already defined Mesh storage under `LOCALAPPDATA/Adamantium Toolbox/mesh` or a configured `ADA_MESH_IDENTITY_DIR` when the Mesh identity was provisioned elsewhere. Both Core and Mesh must point to **the same protected identity directory**. A fresh identity is created only on first use by the existing built-in Mesh identity module. Do not duplicate private identities between simultaneously active hosts.

## Safe relocation / partial failure

1. Inspect current permissions, runtime state and the destination's signed identity **out of band**. Migrate or restore durable data; do not assume a successful API response means data moved.
2. Preserve the logical Mesh identity **only for an intentional relocation**, with secure key transfer, or treat the destination as a separate node if its identity differs. Securely deactivate or fence the previous writer before traffic switches.
3. Read-only capability discovery may try another approved address of the same identity. It returns `read_only_standby` with `canInvoke:false` and hides action nodes when only a standby responds. It does not claim primary availability or show callable buttons until explicit primary promotion.
4. **Mutations never automatically switch endpoints.** The first configured URL is the only primary target for `adamantium_invoke`; an offline, wrong-key or unverified primary fails closed. To switch, explicitly promote the verified destination by editing the trusted registry and re-reading current capabilities.
5. Never auto-retry POST after an uncertain timeout; require idempotency and independent readback. Keep the old endpoint available for read-only audit until cleanly retired.

This is **not** true HA: current Adamantium Mesh transports signed packages, not distributed live capability RPC. Distributed leases/fencing, signed membership, replicated storage, redundant ingress, browser profiles and real ChatGPT MCP pairing remain separate tasks. Browser interactions must use only the discovered, authorized MAS Browser actions. Do not copy cookies/passwords or bypass host-key checks.

## Local tests and production gates

Run `node --test tests/mcp_bridge*.test.mjs`. Tests cover cryptographic signatures, mismatch handling, allowlist visibility, two nodes, hot registry migration, spoofed endpoints, alternate read paths and explicit primary cutover. Each core/bridge production source file stays within 120 lines / 6144 bytes. These tests use loopback mock Core instances and a real loopback MCP listener; they do **not** prove a deployed cross-host HTTPS environment. Do not merge or deploy until the full Windows Core+App regression suite, source scanner, security review and authorized staging ingress checks pass.

## Independent ingress replicas (0.3.0)

The MAS bridge now provides a separate loopback-only authenticated `GET /ready` endpoint requiring `ADA_MCP_PROBE_TOKEN`. The response distinguishes `write_ready` (verified primary), `read_only` (verified standby but no callable actions) and `unavailable`, and exposes a deterministic policy SHA-256 for comparing independently configured bridge replicas. `/health` remains liveness only. The full deployment limitations and no-automatic-POST-retry policy are in `ADAMANTIUM-MCP-INGRESS.md`. This does not deploy HTTPS DNS ingress, authenticated ChatGPT pairing or distributed fencing.
