# Network Checkpoint Transport v0.1.1

Independent MAS plugin for **source-to-witness signed checkpoint delivery**. Deploy the same package separately in `source` or `receiver` mode. Each instance works with Core + this app alone; external services are optional but required to complete a transfer. Core, Approval Ledger, Witness and this transport are NOT imported into one another at runtime.

## Roles

- **Source** (`NETWORK_CHECKPOINT_CONFIG` points to 0600 JSON): read a locally provisioned Approval Ledger JSONL through 0600 permissions, verify its full SHA-256 row chain, pin a configured Ed25519 signing identity, obtain witness high-water mark over pinned mTLS, send at most 32 consecutive rows signed to the segment tip. No private key or journal event is returned to the UI.
- **Receiver**: operator-provisioned mTLS server with CA validation **and exact client leaf SPKI pin**, TLSv1.3, bounded body, single journal binding, no redirect. Receives `/state` and `/anchor`, delegates to a separately installed `network_witness` service through its **operator-provisioned local loopback** capability endpoint. No direct private-key access to the Witness, no duplicated witness storage code.
- **Witness** (existing draft PR #65): validates the source signature, contiguous segment and CAS revision, signs and fsyncs a receipt. The transport verifies the witness receipt's signature and exact journal tip before reporting delivery as confirmed.

## Readiness / permissions

Core actions are `network_checkpoint.status` (read), `.preview` (read, source mode), `.deliver` (deliver, source mode only). Receiver requires separate host policy grants `network_checkpoint.receive`, `network_witness.read`, `network_witness.write` to expose the mTLS ingest; these grants do not themselves authorize internet exposure. Missing or malformed configuration means only status remains advertised. No `apply`, `route`, `firewall`, VPN or secret-export capability exists.

Signed lifecycle may negotiate the manifest port; nothing uses it as a remote target. Operator config has `schema: network-checkpoint-config-v1` and role-dependent objects `source`, `witness`, `receiver`. There are no embedded domains, servers, node IDs, private keys, environment paths or credentials. All private PEM files require mode 0600 and explicit provisioning; identities are never created or rotated by the plugin.

Source config has `source:{journalId,keyId,publicKey,ledgerPath,keyPath,receiptPath}` and `witness:{id,publicKey,url,serverSpkiSha256,caFile,clientCertFile,clientKeyFile}`. URL must be HTTPS with no userinfo, query or non-root path. Receiver config has `receiver:{listenHost,listenPort,serverCertFile,serverKeyFile,caFile,clientSpkiSha256,journalId,witnessId,localWitnessUrl}`. The latter URL must be a local loopback HTTP root URL; it is **never** sent to ChatGPT clients or fetched from the internet.

## Invariants / safety

- A TLS handshake must validate the server hostname+CA **and** pinned SPKI; receiver also authenticates the client cert+CA and pinned SPKI. Key material never traverses the application API.
- Failed/uncertain POST never gets automatically retried. `delivery_unconfirmed` is ambiguous; re-query witness state before a new attempt, with the risk that a remote write already committed. Only a witness-signed receipt proves success.
- The source persists the cryptographically verified witness receipt in an fsynced, 0600 atomic cache under a non-group/world-writable directory. A lower remote witness sequence (or conflicting equal-sequence head) then raises `witness_rollback_detected` or `witness_fork_detected`. Compromise of both local cache and witness still requires a third independent anchor.
- Witnessed sequence strictly higher than the local ledger, or a contradictory anchored row hash, is an observed **rollback/fork**, not a cue to overwrite the Witness. Partial segments are refused by the independent Witness.
- Receiver queries `network_witness.latest` for the **exact operator-bound journal ID**, not the most recent 50 receipts. An untrusted journal ID fails closed rather than claiming genesis. Witness returns a signed receipt and its witnessed revision if present, or an explicit null for a trusted never-observed journal. New sender requires Witness v0.1.1; older Witness deployments without `latest` are rejected rather than silently downgrading to list-based guessing.
- `network_witness.latest` is independent of receipt window size, but the Witness currently replays its local log on each read to validate integrity; very long histories still need a separate authenticated persisted index/performance upgrade.
- A source signing key proves a signing identity, not that each Approval event passed full semantic replay. Source operator must keep the Approval Ledger protected, use signed trust snapshots and replicate witness receipts to another independent failure domain.
- Same-host deployment is useful for tests but not an independent witness. No production endpoint, wildcard DNS, access policy enforcement, SSH or route changes have been made by this package.

## Verification

Run `node --test packages/network_checkpoint/tests/*.test.mjs` against the full Toolbox checkout, with PRs #54 #56 #58 #61 #65 in the stack. CI includes real Approval Ledger→ mTLS transport → real Witness, a 35-row batching case, rollback detection, trust-pin mismatches, isolated Core+app, and capability withdrawal. No production credentials used in tests.
