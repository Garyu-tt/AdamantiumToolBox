# Task Pool R01 — isolated Task Graph provider

This branch extracts the **Task Pool only** from draft #20 plus the read-only graph
descriptor from #96, using the exact pinned source blobs. No Noosphere Lite MCP,
Claude worker activation, or Core changes are included.

- Independent `Core + task_pool` MAS application.
- `task_pool.index` is visible with `tasks.read`, exposes typed
  `mas-task-provider-1` `listAction` and `getAction`.
  Claim/complete/reconcile actions require their own distinct permissions.
- Bounded single-writer JSON state: 256 tasks, 8 KiB payload/result, serialized
  in-process transactions, idempotency key, leased claims and uncertain-outcome
  recovery via `needs_review`.
- No distributed leases, multi-process writer coordination, encrypted store,
  replay-safe external action guarantee, autonomous remediation, or live deployment.
  Do **not** use the initial JSON queue as a million-object storage index.

Tests:
```sh
node tests/task_pool.test.mjs
node tests/task_pool_flow.test.mjs
node tests/task_pool_graph_readonly.test.mjs
node tests/isolation.test.mjs
python tools/architecture-check.py
```

Before live activation: independent QA, signed Lifecycle, permission review and
target readback. Existing failures in Noosphere Lite #20 remain open and must
not be masked by this split. Related #25, #94, #95, #96.
