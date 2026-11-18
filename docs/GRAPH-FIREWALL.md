# Graph Firewall — read-only intent engine (R01)

Status: source prototype, **not deployed**, **not** a Linux firewall.

## Contract

Independent MAS application; starts with Core + graph_firewall only. No
mandatory DNS, Noosphere, Hestia, nftables, WireGuard or external services.

Topology input consists of:
- nodes: unique logical IDs, kinds client/server/gateway, optional IP addresses
- services: unique logical IDs, a hosting node, TCP/UDP port, optional IP addresses
- rules: unique IDs, source node ID, destination service ID, allow/deny, reason

All allow rules are narrow, directional links. Wildcards, unknown node IDs,
duplicate IDs and invalid ports are rejected. Default intent is **deny**.
A matching deny overrides an allow; contradictory rules are reported.

Available read-only actions:
- graph_firewall.inspect(topology): graph nodes, directed edges, warnings
- graph_firewall.simulate({topology,flow}): logical allow/deny for one flow
- graph_firewall.plan({current,proposed,managementFlows}): added/removed/modified
  rules, loss-of-management-access diagnostics and unresolved binding risks

All results say they are **not enforced**. No action mutates host firewall,
exposes an apply capability, opens a port or alters DNS.

## Integration across VM 121 and VM 122

VM 122 may host the small control-plane facade; VM 121 is discoverable as an
independent service node. Graph Firewall does not require either specifically.
A Composite Program can present Graph DNS, Firewall and Noosphere diagnostic
capabilities on one screen while preserving independent authorization.

DNS records are **locator hints**, never authorization. A DNS IP change cannot
grant access to a new principal. Access is based on the pinned cryptographic
MAS node identity verified by the runtime, not a hostname or caller-supplied
node label. IP/port/interface/NAT/VRF bindings require a separately verified
adapter before compiling effective rules.

## Production enforcement requirements

1. Introduce an independently installed nftables (or other OS firewall)
   provider with typed capability versioning and no raw-shell templating.
2. Read interface/NAT/WireGuard/route inventory and pin service identity.
   Stage compiled rules in isolated chains; do not overwrite host management.
3. Check rule syntax, simulate expected management flows and probe actual
   connectivity using an **out-of-band** verified channel.
4. Pre-arm an autonomous time-limited rollback independent of the modified
   network, then require explicit operator approval before an atomic apply.
5. Record transaction ID, expected base revision/hash, diagnostics and rollback
   provenance. Refuse stale writes or unknown peer identities. No implicit
   remote write failover.

This prototype cannot guarantee packet-level security or prevent lockouts.
