# Network Inventory R01 — authenticated, unprivileged observation

**Status:** reviewed source prototype and CI tests; not deployed to VM 121 or
VM 122. No changes to kernel routes, DNS, nftables, firewall or WireGuard.

## Independent MAS contract

`network_inventory` runs with only the minimal Core. It exports:
- `network_inventory.snapshot({})`: read-only OS interface addresses and
  best-effort Linux route information, with observable graph nodes/edges,
  timestamp, digest, evidence provenance and explicit warnings.
- `network_inventory.reconcile({targetNode,topology})`: capture a **fresh**
  local snapshot and compare desired Graph Firewall service addresses to
  locally observed addresses. Caller cannot inject its own network evidence.

Only authorized clients with `network_inventory.read` may query either
action. The health endpoint returns process liveness, **not inventory data**.
UI appears only when the capability is present and approved.

The interface source uses Node's `os.networkInterfaces()`, returning
interface names, assigned IPv4/IPv6 addresses, CIDRs and internal status. It
does **not** export hardware MAC addresses in R01. On Linux, the route parser
reads `/proc/net/route` and `/proc/net/ipv6_route` as optional, fixed
kernel paths. No shell calls, privileges or arbitrary file-path access.

## Observations are not authorization

A matching IP verifies only that it was observed in the **process's
current network namespace at snapshot time**. It does not prove:

- the identity of remote nodes, ownership of public IPs, routing policy,
  network namespaces beyond the local process or multiple route tables;
- interface link/carrier status, NAT, forwarding, firewall policy, conntrack;
- WireGuard peer keys, approved Mesh Ed25519 identity, service availability;
- persistence of DHCP/DNS changes or reachability of management sessions.

Result flags `nodeIdentityVerified:false`, `routingVerified:false`,
`natVerified:false`, `managementReachabilityVerified:false`,
`canApply:false` are deliberately not overridden by matching IPs.

On Windows and non-Linux systems, address observation works but route sources
are marked unsupported, never silently interpreted as an empty route table.
Missing route sources on Linux generate visible diagnostics.

## Graph linkage and migration use

Graph DNS publishes mutable locator data. Network Inventory observes local
interface/route data. Graph Firewall expresses requested access policy, while
nftables Preview generates **unapplied** rule candidates. A Composite Program
can discover and show these capabilities side-by-side with existing ACLs;
none is a mandatory dependency of the others.

For Hestia migration, this module can help detect a configured mail service IP
that differs from observed local interfaces; it cannot prove correct MX,
SPF, DKIM, PTR, SMTP binding, or outbound NAT without additional adapters.

The integration into VM 121/122 requires independent authenticated MAS
identities, appropriate access to the guest namespace, explicitly approved
read-only inventory queries, restore-tested off-host backup and independent
management-path checks before a separate privileged enforcement provider is
considered.
