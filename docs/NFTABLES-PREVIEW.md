# nftables Preview R01 — isolated MAS provider

**Development status:** source prototype. No deployment to VM 121 or 122. This is
**not** an nftables rule installer or kernel firewall, and produces **no
executable nftables transaction**.

## Purpose

The provider takes an exported Graph Firewall logical topology and an explicit
`targetNode`. It generates a deterministic, bounded list of candidate
incoming IPv4/IPv6 TCP/UDP allow rules for services hosted on that target.
There is no imported dependency on Graph Firewall; the compatible input schema
is data, not a mandatory companion plugin.

An explicit deny for the same source-node/service pair suppresses the allow
candidate. All other traffic is **logically** denied by default; this is an
intent statement, not a kernel chain policy. Missing address bindings and
IPv4/IPv6 family mismatches are visible warnings. Invalid identifiers, IPs,
protocols, ports, duplicates, topology size and expansion limits are rejected.

The only exported MAS action is:

`nftables_preview.compile({targetNode, topology})`

It requires `nftables_preview.read` and returns
`nftables-intent-preview-1`, with fields: `candidate`, `skipped`, `warnings`,
`revision`, `unverified`, `safeToApply:false`, `applied:false`.

## Security model

DNS and caller-supplied IP values are not a cryptographic proof of node
identity or routing ownership. A local preview must NEVER be interpreted as
authorization to install rules. In particular, the output does not know:

- approved Mesh peer identity, or whether a source address belongs to it;
- actual nftables table/chain/hook priority and existing kernel policy;
- interface and network namespace, NAT, route, WireGuard or VRF state;
- real out-of-band operator connectivity, rollback readiness and approval.

The provider is **read-only by construction**. No shell, `nft` subprocess,
CAP_NET_ADMIN, privileged socket, persistence or implicit remote RPC. It is
safe to test alongside other MAS apps on a CPU-only host.

## Path toward a separate enforcement provider

1. Discover target identity, interfaces and observed routes from authenticated
   node inventory (not DNS alone).
2. Perform kernel-supported syntax validation of a typed serialized transaction,
   against a pinned base-ruleset revision. Use nftables' supported JSON/native
   forms, never raw policy-label substitution. See
   https://manpages.debian.org/unstable/libnftables1/libnftables-json.5.en.html
3. Prove management reachability from an independent channel. Stage only in
   owned chains, preserve existing host rules and pre-arm automatic rollback.
4. Require explicit operator approval before any privileged application; verify
   actual packet paths and record tamper-evident audit artifacts.
5. On timeout, changed route, invalid identity, unknown source, or disconnected
   out-of-band probe, fail closed **without claiming success**.

Both VM 121 and VM 122 may appear as dynamic topology nodes; neither is
mandatory for this application. Their shared Proxmox host is not HA.
