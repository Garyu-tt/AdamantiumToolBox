# nftables transaction graph R01

**Status:** strictly read-only planning logic. No Linux packet filter
operation, no privileged port, no file writes or automatic rollback scheduling.

The independent `nftables_preview` app exports the second read-only action
`nftables_preview.transaction({targetNode,topology,managementFlows,
 inventory?,wireguard?})`. This imports only its local compiler.

It returns a deterministic digest and the candidate rule set plus a DAG:

```text
pinned_identity -> inventory -> vpn_nat -> kernel_revision
  -> management_probe -> rollback_watchdog -> operator_approval -> commit
```

All eight gates are marked `blocked` because the current prototype has no
privileged kernel attestation provider, independent connectivity probe, actual
rollback watchdog or signed operator approval. Returning a complete graph
is **not** the same as permitting changes. Always:
`state:'draft', applied:false, readyToCommit:false, rollbackArmed:false`.

Explicit `managementFlows` let the planner detect when the candidate rules
would not preserve an expected management TCP/UDP service flow. Absent flows
are a visible blocker, not implicitly accepted.

Optional Network Inventory and WireGuard snapshots can highlight missing
destination IPs or peer diagnostics, but are **caller-supplied data**, so cannot
satisfy the corresponding attestation gates. DNS and WireGuard identifiers
do not independently grant policy authority.

## Next implementation boundary

A future independent privileged provider must check a signed node identity,
a read-back of the current nftables ruleset, kernel parser validation,
interface/routing/NAT identity and independent management reachability. It
must pre-arm a watchdog that can revert the transaction without reliance
on the changed network, then require explicit operator approval binding
the exact plan digest. Only after commit/readback/probe can status be
marked verified. Each intermediate failure must retain diagnostic
evidence and avoid repeated ambiguous writes.

No current module implements the privileged provider; keep this PR draft
until separated and verified on a disposable isolated test namespace,
followed by a controlled operator-approved deployment.
