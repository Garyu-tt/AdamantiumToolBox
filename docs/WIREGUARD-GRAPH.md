# WireGuard Graph R01 — public-only peer observation

**Status:** independent MAS source prototype. No installation, VPN changes,
routing edits, tunnel creation or firewall deployment on any VM.

## Standalone capability

The `wireguard_graph` app requires only Core and `wireguard_graph.read`.
Its only action, `wireguard_graph.snapshot({})`, produces a dynamic graph of
local WireGuard interface names, public-key *fingerprints* and AllowedIPs.
It reports missing or stale handshakes, exact/overlapping AllowedIPs and
wide default-route prefixes. Overlap calculation covers conventional IPv4
and IPv6 CIDRs; unsupported IPv6-embedded-IPv4 prefixes are flagged rather
than asserted non-overlapping.

## Data minimization

The local collector executes only two fixed read-only forms of the operator-
configured absolute executable path in `ADA_WG_READONLY_CLI`:
- `wg show all allowed-ips`
- `wg show all latest-handshakes`

It deliberately **does not** invoke `wg show all dump`, because dump output
includes interface private keys and preshared keys. No user-provided command
names or arguments, no shell expansion, no export of raw public keys, no
private-key/preshared-key retrieval. The output exposes SHA-256 fingerprints
of public keys (truncated to 128 bits) and address-prefix metadata.
Treat even these fingerprints and prefixes as **sensitive network inventory**;
the service is restricted to authorized local MAS calls. Disallow arbitrary
remote access to the process port.

If the executable is unconfigured, inaccessible or the collector fails, the
result is explicitly `status:unavailable`, never an invented empty VPN.
The collection can only observe the local namespace/privilege context and
may omit peers from other namespaces or control planes.

## Authentication is separate

A WireGuard public key observed locally is **not** proof that the matching
remote node currently owns the key, nor that the peer belongs to an approved
MAS Mesh registry. Handshake timestamp is historical observation, not a
challenge-response to an approved control-plane identity.

Neither AllowedIPs nor DNS locators grant Graph Firewall permissions.
Future Mesh identity mapping must use pinned identities, fresh verification
and approved policy before a firewall change can be staged.

## Production gates

For VM121/VM122 first verify operator-selected node identity and a least-
privilege read-only collector. Then reconcile Network Inventory addresses,
wireguard_graph peer ranges, graph_dns locator hints and Graph Firewall
policy. A distinct privileged provider must verify routing/management
reachability, syntax, revisions and prearmed autonomous rollback before any
approved firewall commit.

This plugin does not implement nftables rule application.
