# Network Approval Ledger v0.1.0 — independent MAS plugin

`network_approval` provides a **persistent signed-approval workflow**, not a WireGuard or firewall controller. It runs with **Core + network_approval alone**. No dependency on JediControl, Network Fabric, Network Policy Manager, Network Reconciler, Leonardo, Noosphere, or the ChatGPT MetaBridge.

## State machine

- `network_approval.prepare` generates a random 128-bit request ID and signing payload (no change of state).
- Source uses its **own external Ed25519 signer** on the exact canonical request; `network_approval.propose` verifies and journals it (`pending`).
- Destination independently signs that exact request; `network_approval.endorse` verifies and journals it (`bilaterally_signed`).
- Either side signs a reason-specific revocation payload; `network_approval.revoke` journals a permanent terminal `revoked` state.
- Expiry is derived from `expiresAt` at every read. A request cannot be renewed in place; a new request and signatures are required.
- Every mutation requires `expectedRevision` (the current journal head) to reject ambiguous/stale writes. If a write times out, **read back before retrying**.
- `network_approval.list`, `status` and `challenge` are read operations; `propose`, `endorse` and `revoke` require `network_approval.write` *and* valid signer proof.

## State and trust

The operator provisions two **absolute, configurable file locations** (never hardcoded in the package):

- `NETWORK_APPROVAL_TRUST` — JSON with `{ "schema":"network-approval-trust-v1", "nodes":{ "logical-node-id":{ "keyId":"...", "publicKey":"...PEM..." } } }`; only pinned **public** Ed25519 keys. For one bilateral request, both nodes must resolve to different actual keys.
- `NETWORK_APPROVAL_JOURNAL` — append-only JSONL journal created with mode 0600. Pre-create its parent directory and secure it using OS permissions. Only one writer process can hold the `.lock` file. After a crash, an abandoned lock requires **manual operator recovery**, not unsafe auto-steal.

No secret key or signer is bundled. Private signers should live in independent hardware/device-keystores or another explicitly authorized component. Trust changes are operator-controlled and require new verification, not client self-registration. The ledger records a SHA-256 hash chain and fsyncs appended events. **A hash chain does not prevent a privileged attacker from truncating the file and recomputing history.** External signed checkpoints/replicas and backup verification are mandatory before production-grade enforcement. For additional safety, corrupted, truncated or over-permissive journal files fail closed and remove mutations from the capability graph.

## Live MAS endpoints

- `GET /health` (unprivileged liveness; not readiness or authorization)
- `GET /graph`, `POST /invoke` on loopback, guarded by MAS host-delegated internal key; Core gates each action through `ADA_CAPS` (`network_approval.read`, `network_approval.write`).
- Actions: `status`, `list`, `prepare`, `challenge`, `propose`, `endorse`, `revoke` under the `network_approval.` namespace. Minimal Raw UI is read-only.
- UI clients receive **no signatures or PEM public keys**, only non-secret request metadata, signed-side flags and `advisoryOnly: true, enforcement: false`.

## Security limits

**No enforcement integration in this release.** A `bilaterally_signed` record is only a proposed authorization that future policy and enforcement components must revalidate against the current network state, current identity, expiration and revocation proof. Existing `network_policy.inspect` and `network_fabric.evaluate` do not automatically consume this new ledger. Exposing the plugin does **not** open a port, add a peer, modify routes or apply firewall rules. Backends must not treat `status` or `list` as sufficient proof for privileged actions.

The journal currently supports one writer, linear reads and a maximum of 8 MiB. It lacks network-wide consensus, witness anchoring, detached operator-signed checkpoints, key rotation history and live enforcement. Operational security review and an external audit witness are required before production installation.

## Tests

`node --test packages/network_approval/tests/*.test.mjs` — contract + journal + HTTP + isolated Core integration (the latter requires full AdamantiumToolBox checkout, from the compatible MCP-Bridge stack). No real network devices, WireGuard keys, firewall or SSH involved. CI checks the isolated Core + app on Node.js 22 with no optional plugins.
