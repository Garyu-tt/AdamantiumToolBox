# Mechanicus Network Fabric · MAS 0.3.0 (read-only)

This is an **independently installable** MAS package for AdamantiumToolBox with `Core + network_fabric` only. No JediControl, Noosphere, Leonardo, WireGuard binary, Graph Manager or other apps required. Graph UI is included for interactive viewing; optional external renderers can replace it. The module does **not** create interfaces, change IP routing, generate keys or alter the firewall.

## Live endpoints

- `GET /health` — local liveness, loopback only (unprivileged metadata).
- `GET /graph` — authorized MAS graph with typed actions.
- `POST /invoke` — `network_fabric.status`, `network_fabric.topology`, `network_fabric.plan`, `network_fabric.evaluate`.
- `view.js` — accessible graph UI which is read-only and filters all input as `textContent`.

Config is an **operator-provisioned** file pointed to by `NETWORK_FABRIC_STATE`; no fixed path. Without it the graph is empty, and every flow is denied. File schema: `network-fabric-state-v1`. It can contain nodes, directed links, policies, signed approvals, and separately pinned public verification keys. Only allowed sanitized fields are returned to clients; never store WireGuard private keys in this file.

`evaluate` does not accept policies/approvals/trust from the caller: it loads them from operator-provisioned state. Side approvals are Ed25519 over a canonical payload and must match individually pinned source/destination verifying identities. Reverse access is always distinct. **`allowed:true` is a policy simulation verdict, not a claim that a firewall rule exists.** `enforcement:false` is explicit.

## Deployment

This package is for the signed `tools/plugin-stage.mjs` lifecycle (currently available in `feature/adamantium-mcp-mesh-bridge`, not `main`). It has a manifest-default port that the installer negotiates/retains. Operator policy must separately authorize `network_fabric.read` / `network_fabric.evaluate`. Inspect `prepare` and signed source before `install --approve`; don't auto-deploy network services. No network-agent/WireGuard/provider or privileged `apply` action is included yet.

## Next modules (separate)

`provider_wireguard` (host-local key management and config rendering), `policy_manager` (signed proposals + per-side approval sessions), `reconciler` (prepare/apply/verify/rollback with management-connectivity watchdog), `graph_manager` and `leonardo` UI providers. These are planned, not installed. DNS wildcards may name ingress hosts but are not a trust or authorization boundary.

## 0.3.0 verification

Local unit checks: `node --test packages/network_fabric/tests/policy.test.mjs packages/network_fabric/tests/topology.test.mjs`.
Core integration (must run from the full repository checkout on the compatible MCP-Bridge feature branch): `node --test packages/network_fabric/tests/core.integration.test.mjs`. Test spawns temporary loopback Core + only Network Fabric and checks discovery, authenticated invocation, no secret leakage, forbidden writes, and plugin hot-revocation; no physical WireGuard or remote hosts are involved.

0.3.0 additionally rejects TCP/UDP port zero, rejects use of a single Ed25519 identity for both approval sides, and only reports `configured:true` after reading a valid operator state file.
