# R08 — Verified Core read boundary

Status: reference module and tests only, not a live MAS deployment. Branch: integration/verified-core-read-r08, stacked on R07.

## Authority and ownership

Task Pool owns task records and leases. Orchestrator owns workflow jobs. Graph Manager and Adamantium-node render read-only views. AgentForge and Cezar are optional execution providers, not task owners.

Source inspection confirms Core kernel GET /api/graph returns a bearer-protected visible permission-filtered graph. Core POST /api/invoke dispatches an exact currently visible action. Task Pool service exposes task_pool.list with tasks.read and replies with an object containing a result array. The source list is capped at 200 and may be incomplete.

## Trusted boundary

R08 VerifiedTaskSnapshotBridge is an inert adapter. The host must supply an independently approved session factory, pinned expectedCore (nodeId, peerFingerprint, policySha256), expectedTaskOwner, and a previously approved R07 publisher.

The approved session implements attest(), readGraph(), invokeRead(action,params) and close(). The connector MUST cryptographically verify the pinned Ed25519 peer handshake and authenticate Core permissions; R08 only validates the resulting attestation, not the cryptographic handshake itself.

R08 rejects changed node identity, changed pinned policy, read-only standby, missing invocation permission, stale verification older than 30 seconds and future time. Graph is validated before source discovery. Only exact owner.list with exactly limit=200 is permitted. Immediately before task invocation R08 rechecks the attestation.

Unavailable source returns no signed snapshot, never a fabricated empty queue. R07 sanitizes sensitive Task Pool payloads, maintains a durable high-water sequence and signs the read model. R05 independently validates that signature; no view grants task execution or Android permissions. No machine address, account, bearer, private key, Node-RED dependency or network code is embedded.

## Verification

Run Node 22: node --test tests/task_snapshot_core_bridge.test.mjs

Also run R07 and Task Pool regressions using the repository CI task-snapshot-core-read-r08 workflow. Tests use a disposable actual TaskPool and durable FileSequenceStore plus simulated attested sessions. They establish internal integration behavior, NOT evidence that a physical MAS node is connected.

## Remaining production gates

1. Discover the live operator-approved Core through the exact MAS graph tools, which are not currently available to this chat session.
2. Approve independent cryptographic identity proof and tasks.read via an authenticated Core session; do not infer authority from health endpoints.
3. Install the signer, unique durable publication sequence and lifecycle-approved publisher on an approved server without copying private keys into the IDE or Android.
4. Integrate a secure signed SSE feed and device-encrypted last-known-good sequence store, including revocation and rollback tests.
5. Carry out hardware integration checks only after identity and permission gates are satisfied.

R08 does not start any service, change production queues, grant privileges or deploy a new endpoint.
