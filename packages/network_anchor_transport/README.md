# Independent Network Audit Anchor Transport · MAS 0.1.0

This is a **standalone** MAS transport and not a replacement for `network_witness` or `network_anchor`.
Deploy independent instances on approved source and anchor-side nodes; they are not included in MetaBridge. Runs with **Core + this app** (only status if not configured). This package never changes WireGuard, routes, firewall, OS, DNS or identity credentials.

## Sender mode

Operator-owned 0600 JSON config (`NETWORK_ANCHOR_TRANSPORT_CONFIG`) sets `mode:"sender"`, `trustFile`, `sender:{witnessLog,proofCache,url,caFile,clientCertFile,clientKeyFile,serverSpkiSha256}`. Every outbound call is HTTPS TLS1.3, requires CA+hostname verification **and exact server SPKI pin**. Client presents an independently provisioned mTLS certificate. Sender reads an existing 0600 Witness JSONL, verifies all `network-witness-receipt-v1` proofs and the entire SHA-256 chain, obtains signed Anchor state and sends **1–16 receipts** beyond the last Anchor sequence. No private Witness or source signing key is used by this transport. It reports success only after verifying the independent Anchor signature and exact expected high-water, then writes an fsynced 0600 signed-proof cache.

- `network_anchor_transport.status` (`network_anchor_transport.read`)
- `network_anchor_transport.preview` (`network_anchor_transport.read`)
- `network_anchor_transport.deliver` (`network_anchor_transport.send`) — sends signed audit records, **not network-policy grants**

An ambiguous POST returns `delivery_unconfirmed`, `mayHaveCommitted:true`, with no automatic retry. The operator must inspect the remote Anchor's freshly signed state before making another delivery attempt. A truncated or replaced source Witness log, remote Anchor rollback/fork, invalid cert pins or corrupted local cache fails closed.

## Receiver mode

Operator JSON sets `mode:"receiver"`, `trustFile`, `receiver:{listenHost,listenPort,caFile,serverCertFile,serverKeyFile,clientSpkiSha256,localAnchorUrl}`. Receiver uses mTLS client CA **and leaf SPKI pin**. The downstream Anchor URL is an operator-provisioned loopback-only HTTP root; no dynamic target URL is accepted from a client. Receiver only forwards to the independently installed Anchor `/invoke` API, requiring `network_anchor_transport.receive`, `network_anchor.read`, and `network_anchor.write` for commits. Only exact CAS and batch boundaries are accepted. No signing private keys are present in receiver.

## Security, deployment and tests

All keys and endpoints are operator provisioned; never commit them to git. The public trust file uses existing `network-anchor-trust-v1` with three independent pinned Ed25519 roles (source, Witness, Anchor). Private TLS keys and config files must be mode 0600, filesystem paths absolute, no symlinks. Signed lifecycle/registry/permissions and per-node authorization must be inspected before installation.

The proof cache detects replay/rollback only while independent Anchor attestations and the cache remain intact. A compromised source AND independent Anchor plus key cannot be defeated with a local hash chain. No durable physical isolation or immutable storage is claimed by tests. A third-party archive or WORM-backed anchor is a later deployment concern.

`node --test packages/network_anchor_transport/tests/*.test.mjs` — contract/receiver sender and isolated Core smoke. Test fixtures import source modules from Witness and Anchor only under `tests/`; **runtime files never import another app**. No background schedule, root process, real WireGuard or production hosts are touched.
