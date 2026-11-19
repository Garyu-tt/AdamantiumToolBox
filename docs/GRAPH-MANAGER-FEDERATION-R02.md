# Graph Manager R02: bounded task, function and file-map federation

Status: draft source change stacked on Graph Manager R01 PR #43. No deployment or automatic storage migration.

## Source of truth
- Existing Core permission-filtered `api.graph()` is authoritative for visible runtime functions; a manifest or GitHub PR is not proof of live deployment.
- Existing CodeGraph `/api/codemap/graph` is retrieved only after an explicit click through a host-provided read helper; Core retains the `codemap.read` permission gate. This is static, partial import analysis, not a live file locator.
- A Task Pool reader is discovered through an authorized visible `mas-task-provider-1` resource with `listAction`, or the same-owner legacy `.list` action. Graph Manager invokes a read action only via `api.call`, preserving its Core authorization; it never claims or changes a task.
- Missing provider means no tasks displayed; never invent task states. The current Task Pool PR #20 exposes its provider metadata only when claim access is granted: read-only discovery needs its own follow-up contract change.
- Graph Manager does not own task state, Core capabilities, memory or file content.

## Mapping
- `mas:<owner>` → `<owner>.capability` is observed runtime containment.
- `mas:<owner>` → `file:apps/<owner>/...` denotes source-path association with an **observed** owner, not deployment proof for the source revision.
- `file:<path>` → `file:<imported>` is a static import edge.
- `task:<taskId>` → `<actionId>` exists only if a task's declared `requires` string exactly matches an authorized visible action. Otherwise the unresolved edge is recorded as missing, not silently linked.
- Every imported object records origin and revision/hash where supplied; no inferred permission is added.

## Safety/scale gates
- Explicit loading of CodeGraph/tasks, not polling every source scan. Capability graph still refreshes through the existing UI path.
- At most 250 CodeGraph nodes, 800 import edges, 200 task rows; at most 160 visible vertices rendered. Truncation is reported in snapshot warnings. Limits keep the first slice bounded, **not** million-file readiness.
- Source objects are read-only data. No automatic repair, file write, migration, archive unpack or task claim. Export is user initiated.
- Separate Storage Atlas provider remains required for indexed file locators, segmented tiny-object storage, durable metadata, sharding and recovery. Never use Graph Manager as the physical metadata database.

## Verification
`node tests/graph_manager_federation.test.mjs` proves missing providers, task→action dependencies, file→file imports, source grouping, impact, and truncation. Also run existing Graph Manager tests and whole architecture/CI gates before merging.

## Next increments
1. Task Pool publish read-only provider descriptor when `tasks.read` is authorized, including explicit `listAction`, without exposing claim.
2. Add revisioned, paginated storage index provider for `file → segment → node → replica`, with bounded streaming projections.
3. Add incremental event cursors, reverse-index queries and CAS to avoid rescanning whole graphs. Test 1 million synthetic object IDs, memory ceiling and crash recovery; never render 1 million SVG nodes.
4. Preserve typed incident and task links through the recursive recovery loop PR #92, verified Fixiki receipts, independent QA, approval and readback.

Related: #25, #24, #36, PR #20, PR #39, PR #43, PR #92.
