# Network WireGuard Provider — MAS v0.1.0

Independent recursive MAS application: `Core + network_wireguard` only. Requires no `network_fabric`, JediControl, Noosphere, desktop, Leonardo or Graph Manager. Implements `mas-http-1` and basic Raw UI; declared port is a negotiable installer default.

**Scope:** read-only local WireGuard discovery using the host's existing `wg show all dump`. No `wg set`, `wg-quick`, routes, nftables/iptables, key generation, key exports, network interface configuration or privileged writes. `wg` is optional; if absent, the provider exposes only authenticated diagnostics. Works through Core `/api/graph` and `/api/invoke`; never expose its loopback HTTP port directly to ChatGPT.

Security: `wg show all dump` includes local WireGuard private keys and peer preshared keys. The provider's parser **discards those fields before returning any data** and never writes raw output to disk or logs. Public keys are represented as SHA256 fingerprints; raw endpoints are omitted (only `endpointConfigured`). Authorization uses Core's capability `network_wireguard.read` and a host-internal secret. CLI executable path can be set by trusted operator environment `NETWORK_WG_BIN` (test fixtures), not by API clients; command and arguments are fixed and executed without a shell. Permission failures return coarse error codes, without stderr or private configuration data.

`AllowedIPs` are routing indicators, **not** proof of ACL enforcement. No network access is granted or revoked by this plugin. Bilateral signatures and policy evaluation remain in the independent `network_fabric` app. A later optional `network_wireguard_reconciler` can implement privileged plans + owner authorization, per-side approvals, dry-run, management-connectivity watchdog and rollback.

Run tests: `node --test packages/network_wireguard/tests/*.test.mjs` (Core integration requires checkout of the feature branch that includes the signed MCP Bridge Core). Signed stage: `node tools/plugin-stage.mjs prepare packages/network_wireguard`; no installation without reviewed source and explicit user authorization. Production deployment has not been performed.
