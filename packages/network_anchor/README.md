# Independent Network Audit Anchor · MAS 0.1.0

`network_anchor` is a **separately installable read-only audit verifier with optional append-only attestation writes**. It is **not** a network policy grant, privileged reconciler, firewall, VPN, tunnel or WireGuard provider.

## Contract

An approved operator separately provisions the **Anchor** Ed25519 key and pinned public verification identities for (1) itself, (2) one Witness, and (3) each source journal. None of these signing identities may share keys. The plugin verifies existing Witness `network-witness-receipt-v1` records against independent pinned signatures from the source and the Witness, and checks the exact contiguous Witness hash chain. It never imports another MAS app at runtime.

The Anchor stores batches of 1–16 verified receipts in its own protected append-only JSONL journal, fsyncs each mutation, and signs a separate `network-anchor-attestation-v1` over its journal revision and the witnessed high-water. Receipt bodies contain **no original Approval Ledger events**; they remain source-owned. Concurrent mutations require optimistic `expectedRevision` and a single-writer lock. Corrupted/truncated journal or invalid keys disable mutating capabilities.

## Capabilities

- `network_anchor.status`: read service readiness, signed journal head and last witnessed sequence
- `network_anchor.latest`: read the last independent signed attestation
- `network_anchor.inspect`: verify a supplied **Witness-signed** observation; states `matches_anchor`, `older_than_anchor`, `fork_detected`, `ahead_of_anchor`, `invalid_proof`. A stale supplied proof does not prove that the remote Witness actually rolled back.
- `network_anchor.commit`: write 1–16 authenticated, contiguous Witness receipts, with revision-CAS. **This only writes an audit record.**

`/health` is liveness only. `/graph` and `/invoke` require host-delegated `ADA_INTERNAL_KEY` and `network_anchor.read` or `.write` permissions. Source/core state is not embedded. Raw UI may be substituted by an optional graph renderer.

## Operator state

The operator supplies `NETWORK_ANCHOR_LOG` (existing or new absolute journal path), `NETWORK_ANCHOR_TRUST` (existing strict 0600 trust JSON) and `NETWORK_ANCHOR_KEY` (existing strict 0600 Ed25519 private PEM). The plugin never generates permanent keys or guesses paths, ports, domains or nodes. Trust JSON uses schema `network-anchor-trust-v1`, `anchor:{id,keyId,publicKey}`, `witness:{id,keyId,publicKey}` and `sources:{journalId:{id,keyId,publicKey}}`.

## Limitations

A local Anchor instance on the same physical or administrative host **does not** guarantee independent failure resistance. An attacker able to replace the Anchor journal and signing key can forge a fresh history unless attestations are retained in yet another trust domain or externally pinned. Real independent host deployment, asynchronous receipt delivery, key rotation, offline recovery and immutable storage remain future work. The Witness has verified only source checkpoints and contiguous row hashes, **not** complete Approval Ledger event semantics.

This is source-only. No production topology, network access, filesystem outside a dedicated temporary test root, DNS, wildcard ingress, firewall policy, WireGuard, SSH or remote host is altered by the CI tests.

## Test

`node --test packages/network_anchor/tests/*.test.mjs` from the full repository checkout (for **test-only** compatibility with the Witness standard). Unit tests validate attestation signatures, trusted identity separation, crash-replay safety, contention and corruption. Interoperability tests run the **real Witness Store**. Core isolation tests launch **Core + network_anchor only**, without optional runtime plugins.
