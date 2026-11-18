# Adamantium Task Pool + Noosphere Lite Read-Only Bridge (R0)

Two standalone MAS applications that run with **Core + App**. They are optional providers for Orchestrator, Claude and any other consumer. No hardcoded cross-app imports or URLs.

## Task Pool
- Actions: `task_pool.submit` (`tasks.create`), `task_pool.list`/`task_pool.get` (`tasks.read`), `task_pool.claim`/`task_pool.heartbeat` (`task_pool.claim`), `task_pool.complete`/`task_pool.fail` (`tasks.finish`), `task_pool.reconcile` (`tasks.review`).
- Example submission: `{"title":"Summarize incident","requires":["ai.text.generate"],"payload":{"prompt":"Incident summary"},"idempotencyKey":"incident-123"}`.
- Example claim: `{"workerId":"claude-worker-1","capabilities":["ai.text.generate"],"leaseMs":300000}`. Returns a task ID, payload, lease token and expiry. The worker needs the exact token to heartbeat, complete or fail.
- A claim is granted only once within this **single-writer runtime**. Concurrent claims serialize. Expired leases and claimed tasks present at restart become `needs_review`; there is **no blind retry** of potentially mutating work.
- To resolve an uncertain task, `task_pool.reconcile` requires explicit `confirm:true`, disposition (`requeue` or `cancel`) and a human-readable reason.
- The first release has a 256-task local store with 8 KiB per-task payload/result limits. Local JSON is atomic, but not encrypted by the application. Protect it with host filesystem ACLs and disk encryption.
- Worker IDs are self-declared and tokens are random. Per-worker cryptographic subject binding, distributed fencing, cross-host coordination, retention and host failover are not implemented yet. Do not run multiple Task Pool processes on the same store.

## Noosphere Lite Bridge
- Runs only if `ADA_NS_MCP_COMMAND` is configured to a trusted local executable and `ADA_NS_MCP_ARGS` is a JSON argv array. Execution uses `shell:false`; no endpoint or fixed installation path is embedded in the plugin.
- Passes a restricted child environment: basic platform variables and `NSL_*` Noosphere configuration. Set `NSL_PRIMARY`, `NSL_MIRROR`, `NSL_KEY_FILE` privately on the host.
- Speaks stdio MCP, performs initialize and tools/list, and exposes **only** `memory_search` and `memory_read` as `noosphere_lite.search` and `noosphere_lite.read` if both the provider and Core permission allow.
- Example search: `{"query":"architecture decision","limit":8}`. Read: `{"memory_id":"existing-node-id"}`.
- No writes, no memory ingestion and no automatic trust in retrieved notes. Responses are tagged `verified:false`.
- Current adapter starts a separate MCP subprocess per request and uses a bounded timeout. This is simple and safe for R0, but a persistent authorized session pool is needed before high-frequency production queries.

## Integration
The existing Orchestrator can call `task_pool.claim` → `claude.start` → `claude.status` → `task_pool.complete`, using its general graph DAG engine. Task results, Noosphere reads and Claude calls are connected by the **consumer's** declared workflow, not by making these applications depend on each other.

Orchestrator and Claude must already exist in the target environment. Installing Task Pool or Noosphere Bridge alone does not activate Claude or grant it memory access. Long-running tasks require a separate worker heartbeat controller; the initial DAG demonstration is intentionally short.

## Acceptance
```sh
node tests/task_pool.test.mjs
node tests/task_pool_flow.test.mjs
node tests/noosphere_lite.test.mjs
node tests/isolation.test.mjs
python tools/architecture-check.py
```
Tests use synthetic data only. This PR does not deploy the plugins to any host or access private Noosphere content.
