# R07 — Task Snapshot Publisher (server-only, optional, read-only)

Status: reference implementation and CI, **not deployed**. No services are started by importing this module. This is a separate publish-side component in AdamantiumToolBox, not a replacement for Task Pool, Graph Manager, Orchestrator or Adamantium-node.

## Why

The upstream Adamantium-node draft R06 can read a permission-filtered Task Pool source and validate R05 signed envelopes, but an actual authenticated publisher was missing. R07 adds a small publication boundary on the server. No browser, Node-RED flow or Android client is allowed to hold release-signing private keys.

## Canonical responsibility

- **Task Pool** persists tasks, leases, per-task revision, outcomes.
- **MAS Core** enforces permissions on graph visibility and on each read action.
- **Task Snapshot Publisher (R07)** gets a narrowly scoped Core read callback, sanitizes task status, assigns a monotonic publication sequence through an external durable allocator, signs a short-lived read-only snapshot.
- **Adamantium-node Graph Manager UI** projects the snapshot, but never becomes a second queue or signer.
- **Android AI Core** checks an independently pinned public key and protects last-known-good/high-water state. A valid view is not an execution grant.
- **Orchestrator** remains responsible for authorized DAG execution, separate from Task Pool and its publisher.

## Source discovery

Accept only an already authenticated and permission-filtered Core graph containing a resource with schema mas-task-provider-1 and a visible same-owner exact `owner.list` action. The approved source owner must be explicitly supplied by the operator; an arbitrary new node cannot become task authority just by publishing a descriptor.

Call only that list action with `{limit:200}`. No `claim`, `complete`, `submit` or `reconcile`, no direct loopback port probing, hardcoded service locations, external provider magic IDs or raw filesystem access.

Absent source -> `source-not-visible`; failed read -> `source-read-failed`. Neither returns an empty queue or signed report. The source list is always flagged **partial**, because Task Pool R01 supports up to 256 task records but the API returns at most 200.

Current R01 real status mapping:
- queued -> queued
- claimed -> claimed (lease, not proof of execution)
- needs_review -> needs-review with read-only diagnostic reason
- completed -> completed-unverified (not independent QA evidence)
- failed -> failed
- cancelled -> cancelled

The Task Pool requires array contains capability requirements, **not task predecessors**; no DAG edges are inferred. Lease tokens, raw payload, private outcome/results, worker identifiers and sensitive fields are not emitted. Task titles and diagnostic reasons themselves may still be sensitive and must not be published to untrusted clients.

## Signed wire contract

The publisher creates `mechanicus.orchestration-signed-snapshot/1` envelopes compatible with the upstream R05 reader: Ed25519 signature on the exact JSON bytes, issuer bound to the configured Task Pool owner, short maximum 5-minute TTL (default 2 minutes), max 768KiB payload, monotonic publication sequence. R05 expects the view revision to increase for each accepted snapshot, so R07 sets both sequence and *publication-view revision* to the reserved monotonic value. These are **not** claims about Task Pool per-task revisions or a global Task Pool CAS version.

An operator-owned signing KeyObject, trusted Core callbacks and the `reserveSequence({streamId,issuerProviderId})` function are **required injections**. The callback must allocate and durably commit a unique increasing number across process restarts and concurrent publishers before the signature is exposed. An in-memory counter is only suitable for tests; it is NOT an approved live allocator. Skipped numbers after crashes are allowed; reused numbers are not.

Signed data has no bearer token, signer secret, endpoint, execution approval, or MAS write capability. The app does not automatically generate keys and never enables a new permission.

## Reproduction

```sh
node --test tests/task_snapshot_publisher.test.mjs
node --test tests/task_pool.test.mjs tests/task_pool_graph_readonly.test.mjs
```

Unit tests include a **real local TaskPool instance in a disposable temporary directory**, as well as forged descriptors, absent backend, denied read, duplicate rows, signature tampering, privacy filtering, real completed tasks and monotonic sequence handoff. No live process, external network or production secrets are used.

## Not yet implemented

1. Validate one live registered MAS Core/Task Pool identity through pinned Mesh and approved capability discovery, not process names, `/health` or manifest ports.
2. Choose a single canonical operator-approved signer and durable CAS sequence store. **No automatically provisioned keys** and no second live signing authority.
3. Expose an explicitly permission-gated, loopback-only publisher capability through a separate approved Lifecycle/manifest release.
4. Bind HTTPS + WireGuard authenticated ingress and persist Android high-water mark and last-known-good snapshots; add failover/clock/revocation tests.
5. Extend the source with authenticated independent QA receipts and paginated tasks; the current JSON Task Pool is small and cannot prove complete DAG coverage.

R07 source is intentionally inert until those gates are satisfied. Existing agent processes, credential stores, Task Pool queues and production services are unchanged.
