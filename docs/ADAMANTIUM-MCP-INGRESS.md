# Adamantium MCP: independently checked ingress replicas

Status: tested **source design**, NOT deployed HTTPS ingress and NOT a live ChatGPT connector.

## A stable address without a fixed server

A user-operated stable HTTPS name is the *only* ChatGPT-facing endpoint. Under that name, use at least two independent proxy/ingress instances in separate failure domains, and run `Core + mcp_bridge` on two independently managed Adamantium hosts. Their routes to other MAS Core nodes come from each bridge's approved, hot-reloaded registry. Do not expose Core on the public network and do not put node IPs in ChatGPT or the thin client.

```
ChatGPT -- HTTPS /mcp --> stable operator-controlled ingress
                                  |        |
                       proxy replica 1  proxy replica 2
                                  |        |
                     mcp_bridge A      mcp_bridge B (loopback)
                                  \        /
                       pinned MAS capability registry
                                  |
                      signed Core identities / graphs
```

Both bridges can run simultaneously because they have no private mutable conversation state. This alone does **not** make the back-end application data replicated or protect against split-brain across two Core writers. The stable domain itself must survive proxy/host/DNS outages; two bridges behind a single proxy are **not** zero-SPOF.

## Health semantics

- `GET /health`: unauthenticated **local liveness only**. It never means Core can be reached; never use it as the only traffic-admission check.
- `GET /ready`: loopback readiness probe, disabled without an independently provisioned `ADA_MCP_PROBE_TOKEN` of at least 24 characters. Supply `X-Adamantium-Probe` with the exact token. The endpoint does not accept unauthenticated polling or expose node keys/credentials.
- With a configured `ADA_MCP_BEARER` and a freshly verified approved Core primary, the probe returns HTTP 200 and `{mode:"write_ready", primary:N, standby:M, policySha256:"..."}`.
- If only approved secondary Core paths pass the Ed25519 challenge and expose compatible graphs, return HTTP 200 and `mode:"read_only"` with **zero callable capabilities** on those routes. Do **not** treat HTTP 200 alone as permission to execute mutations.
- No trusted/reachable nodes, invalid configuration, no authentication or disabled MCP: HTTP 503. Invalid probe credentials: HTTP 401. The body exposes only aggregate counts, not private host addresses.
- `policySha256` is a digest of the approved registry's logical IDs, ordered endpoints, pinned public identities and exact action allowlists, with no secret token contents. Compare digests across replica probes before admitting both. A digest mismatch indicates drift and requires operator investigation. This is a **signal**, not distributed consensus or automatic fencing.

## Proxy and external MCP compatibility gates

1. Reverse proxy exposes only the authenticated `/mcp` route to ChatGPT. The `/ready` probe is internal and requires its separate token; the `/health`, `/graph`, `/invoke` and Core APIs remain private.
2. Use valid TLS and a stable operator-controlled service name. A second independent ingress node/DNS routing mechanism must actually take over on gateway loss. DNS caches, client connection persistence, and third-party load balancer behaviour must be tested, not assumed.
3. Forward the external MCP authorization and content negotiation headers exactly. Do not log bearer tokens or request bodies with project secrets.
4. **Disable automatic retries of POST /mcp.** A transport failure after a write may mean Core already executed it. `adamantium_invoke` requires a new explicit user-approved operation or an independent idempotency/readback proof, never replay from the proxy.
5. The current stateless JSON-RPC Streamable HTTP subset must pass the actual ChatGPT MCP client integration, authorization/OAuth requirements and session/response semantics before declaring the address usable. No `mcp.json` should be installed with an unverified address.
6. Check both bridge replicas report the expected policy digest and desired mode at cutover; remove drifted replicas from traffic manually. Do not publish a write path while two Core hosts can own the same logical writer identity.

## Demonstrated and not demonstrated

`tests/mcp_bridge_ingress.test.mjs` starts two separate bridge processes and independently configured Core endpoints. It checks authentication, equal policy hashes, successful operation through the surviving bridge after one is stopped, read-only degradation when only a matching standby remains, and explicit promotion. This verifies bridge-level behaviour on a test host, not network/DNS failover or automatic replication.

Real federation, quorum/lease/fencing, signed service membership, encrypted session continuity and multi-region HTTPS routing are separate architectural modules. Keep `mcp_bridge` independent of all of them, and expose their features only after they appear in the live capability graph.
