# Network Audit Witness 0.1.1 — independently installable MAS plugin

## Boundary

`network_witness` is an append-only, **operator-provisioned audit witness** for independent `network_approval` journals. It does not require the Approval Ledger, Graph Manager, Noosphere, JediControl, WireGuard, Network Fabric, Policy Manager or Reconciler at runtime. `Core + network_witness` alone must work; an optional Raw UI reports status.

This software **does not enforce network permissions or replicate itself to another host**. Its `/invoke` API has no route, firewall, WireGuard or SSH mutations. It does not sign checkpoints for a source: a separate authorized source signer must sign the current journal tip with its own pinned Ed25519 identity.

## Operator-provisioned state (no hardcoded paths)

The service requires `NETWORK_WITNESS_LOG`, `NETWORK_WITNESS_TRUST`, and `NETWORK_WITNESS_KEY`, each an absolute path. The key must be an existing 0600 Ed25519 PEM file; the software will neither invent nor rotate identities. `NETWORK_WITNESS_TRUST` contains the pinned `witness` and `sources` Ed25519 verification identities, with different keys. `ADA_INTERNAL_KEY`, `ADA_CAPS` and `APP_PORT` are supplied by the MAS host / lifecycle policy.

Trust schema:

```json
{
  "schema": "network-witness-trust-v1",
  "witness": {"id":"auditor", "keyId":"witness-key", "publicKey":"PEM provided by operator"},
  "sources": {"approval": {"id":"approval", "keyId":"source-key", "publicKey":"PEM provided by operator"}}
}
```

Only publicly verifiable keys appear in that file. Never place secrets, private keys, backend URLs, node memberships or per-owner runtime data in the Git repo.

## API / contracts

- `network_witness.status` — readiness, revision, count, replication=false and enforcement=false.
- `network_witness.receipts` — bounded public receipts with witness and source signatures; there are no original Approval event bodies.
- `network_witness.latest` — one operator-trusted `journalId` to its newest **signed** receipt (or confirmed empty history), plus the global witness revision. Reads are independent of the 50-item list window; unknown/untrusted journal IDs are rejected, never treated as genesis.
- `network_witness.inspect` — compare a signed observed checkpoint against a previously witnessed high-water mark (`matches_witness`, `rollback_detected`, `fork_detected`, `ahead_of_witness`, `unwitnessed`, `invalid_proof`). None represents firewall authorization.
- `network_witness.anchor` — CAS against the witness revision plus a source-signed `network-approval-checkpoint-v1` containing `journalId`, `seq`, `head`, `keyId`, `at` and base64 Ed25519 signature. Also requires `segment`: **1–32 contiguous raw source journal rows**, starting at the last witnessed source sequence (or genesis); each row must match the Approval Ledger hash-chain format.

Witness verifies chain continuation and the independent source signature; stores only signed checkpoint, source signature and a signed witness receipt, never original journal events. Revision CAS prevents two agents overwriting decisions. All mutations are fsync'ed to an append-only local JSONL journal with a single-writer lock, permission checks and verified replay on startup. Missing/corrupted state removes write actions from the live graph.

## Explicit security limitations / next steps

- A same-host witness does **not** protect against an attacker who controls that entire host and its signing key; place it on a separately administered physical failure domain, ideally with HSM or non-exportable signing keys.
- The local witness log is hash-chained, not immutable storage. Complete log replacement/truncation on a compromised witness host can still evade local detection without **externally anchored witness receipts** and independent replicas.
- A source checkpoint proves the *signing identity* asserted the supplied tip; segment validation proves continuity from the previous witnessed head. Neither substitutes for full replay/approval-policy validation by the Ledger.
- The Approval Ledger currently does not expose an automatic signed checkpoint / segment export action. Initial use is an operator-provisioned signing/export workflow. Build an independent exporter and remote authenticated transport in a separate plugin, with pinned identities and bounded replay.
- Signed approvals and witness receipts do not enable network writes. A future privileged reconciler must independently validate current permissions, watchdog connectivity, and safe rollback.

## Verification

`node --test packages/network_witness/tests/*.test.mjs` on the full Toolbox repository checkout, where the Approval Ledger's source is available for a **test-only** interoperability check. The standalone runtime has no import from `network_approval`. CI also tests an actual Core + Witness alone with temporary loopback services and hot capability revocation.

Version 0.1.1 adds exact per-journal lookup without changing the bounded receipt-list API. Each query still verifies and replays the local Witness journal, so read CPU cost is not constant-time; this fixes the history-window correctness issue, not long-history performance. Source is in a draft stacked PR. No production installation, DNS, MCP external ingress, replication or network mutation is implied.
