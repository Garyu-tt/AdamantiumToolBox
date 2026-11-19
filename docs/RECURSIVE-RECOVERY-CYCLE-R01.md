# Recursive Recovery Cycle R01 — one closed loop, no terminal BLOCKED

Status: architecture/design candidate. This document does **not** prove that an agent loop is deployed or that any blocked item has been fixed.

## Invariant

Every observed divergence from a goal creates a durable work item; every work item must have a machine-verifiable next transition. \`BLOCKED\` is an **observable condition**, not an exit state. No worker may finish its iteration with only a diagnosis when a safe, authorized executable next action is available. Diagnosis without attempted progress is not success.

The system is one **logical closed feedback loop** across recursive MAS apps, not a monolithic process or an infinite hot-spin. A complete turn is Observe → Reconcile → Diagnose → Decompose/Select → Execute → Verify → Integrate → Observe again. If a child fails, the failure becomes a new input event for the same loop. If work cannot execute now, persist the cause, state, resumption trigger and independent alternative branches; continue other ready work. Never falsify success.

## Control graph (each edge is a typed event)

~~~mermaid
flowchart TD
  O["Observe: sources, runtime, CI, PR, task results"] --> R["Reconcile desired vs observed, revision"]
  R --> Q{"Verified goal predicate?"}
  Q -->|yes| H["Record verified receipt; inspect reverse dependents"]
  H --> O
  Q -->|no| I["Create or dedupe incident (root ID + evidence)"]
  I --> C["Classify cause, constraints, permissions and budget"]
  C --> A{"Atomic authorized executable step available?"}
  A -->|yes| L["Acquire work lease + idempotency key + CAS"]
  A -->|no| D["Decompose into smaller measurable work"]
  D --> K{"Missing tool, knowledge or provider?"}
  K -->|yes| B["Fork capability/research/provider branch"]
  K -->|no| F["Fork isolated focused fix/test branch"]
  B --> R
  F --> R
  L --> E["Execute smallest reversible change"]
  E --> T["Run targeted tests and independent verifier"]
  T --> V{"Evidence + postcondition valid?"}
  V -->|no| X["Persist failure evidence + rollback if applicable"]
  X --> I
  V -->|yes| M["Integrate via policy gate / staged activation"]
  M --> N["Read back actual runtime, check dependencies"]
  N -->|regression| I
  N -->|restored| H
  C --> P{"Needs missing approval / external resource?"}
  P -->|yes| W["Persist waiting condition, owner, retry trigger; run other ready work"]
  W --> O
  P -->|no| A
~~~

The event/control edges form a cycle. The dependency graph inside a turn may be a DAG and **must** distinguish legitimate dependency SCCs from accidental recursive task creation. A blocked leaf can spawn smaller children, but never an unbounded tree.

## Topology (separate recursively installable MAS providers)

| Provider | Authority / responsibility | No hidden ownership |
| --- | --- | --- |
| **Graph Manager** | Revisioned dependency/capability/task graph, reverse edges, projection, event subscriptions | Not a task worker, memory database, or code executor |
| **Task Pool** | Durable work order, state, idempotency, leases, fencing generation, retry triggers and per-task budgets | Does not generate fixes or grant permissions |
| **Conductor** | One logical reconciliation controller; prioritization, bounded fanout, checkpointed resume, child completion aggregation | Does not embed graph, models, secrets, or remote machines |
| **Forge** | Stateless graph integrity diagnosis, remediation candidate planning/assessment; reuse R10/R11 | No graph store, queue, permission store, executor or self-attestation |
| **Fixiki / Coders / Specialists** | Discover capabilities, repair source/environment/config in isolated branches under granted scopes | No self-approval of own result |
| **Gauntlet / independent QA** | Fresh source SHA, targeted tests, negative/fault tests, independent evidence receipt | Does not infer runtime success from test success |
| **Lifecycle / Delivery** | Separate signed policy, staging, rollback, approval, readback | No silent mutation or unsafe deployment |
| **Noosphere / Evidence Store** | Provenance, hashes, timestamps, compact history; optional for local Core+one-app | Not the executor, not the only available recovery copy |
| **Capability graph** | Live discovery + authorization intersection + revocation | No hardcoded providers, hosts or paths |

Use generic capability discovery: workflows can run on CPU, distributed hardware or connected software, with explicit budgets and **real** measured compatibility. UI/Leonardo/Wayfire remain optional. Keep existing Core compatible; build missing infrastructure as independent MAS apps.

## Typed work graph

Node types: \`goal\`, \`work\`, \`incident\`, \`hypothesis\`, \`remedy\`, \`capability\`, \`provider\`, \`agent\`, \`artifact\`, \`test\`, \`receipt\`, \`policy\`, \`environment\`, \`approval\`.

Edges: \`depends_on\`, \`blocks\`, \`caused_by\`, \`decomposes_to\`, \`requires_capability\`, \`provided_by\`, \`attempted_by\`, \`verified_by\`, \`produces\`, \`restores\`, \`reopens\`, \`unlocks\`, \`approves\`, \`observed_by\`. Every edge has source evidence and graph revision. Reverse dependency index enables automatic recheck of parent and downstream nodes.

A work item is append-only in history and has:
- stable \`task_id\`, \`parent_id\`, \`goal_id\`, \`root_incident_id\`, \`revision\`, \`kind\`, \`priority\`, \`status\`;
- **one measurable postcondition** (\`predicate\`) and minimum reproducible input;
- \`source_ref\` + SHA/hash + environment, evidence references and trace IDs;
- discovered \`required_capabilities\`, actual policy/permissions, resource budget;
- dependency IDs, attempts, depth, owner lease, fencing generation, idempotency key;
- independent verifier requirement, rollback recipe, next retry/resume trigger.

Keep \`source SHA → patch SHA → test command/log hash → verification receipt → live readback\`. A comment, an issue, a green CI job or HTTP 200 **alone** is not proof that the goal predicate holds.

## Recursive decomposition and branching

1. On divergence, capture the exact smallest failing predicate, reproduce and classify. Deduplicate by \`root_incident_id + fingerprint + source revision\`.
2. If a direct low-risk authorized repair exists, acquire a fencing lease, run it once, independently verify and feed the observation back. Do not spend a whole cycle writing a report.
3. If not executable, split into concrete child work that each has a measurable result, test and actual discovered capability. The parent waits for child completion **but is not terminal**; siblings proceed.
4. If a required capability is absent, create a separate \`capability/provider\` branch with a minimal acceptance test, or discover an alternative compatible provider. If knowledge is missing, create bounded research/reproduction work, not “ask the user what to do” by default.
5. If a source change is needed, use a focused Git branch/PR with pinned base/source SHA, file scope, rollback and CI. Check for an active owner/PR first; no duplicate worktrees or blind writes.
6. If repair verification fails, persist evidence, rollback when safe, change the hypothesis or split further. **Retrying the identical action without new evidence is not progress.**
7. If approval, secret, physical replacement, irreversible mutation or paid operation is needed, create a specific approval/request node; do not bypass policy. Resume on approval/webhook/poll and continue unrelated ready tasks.
8. Close parent only after **independent verification**, successful integration where relevant, actual-state readback and all mandatory child predicates. Any regression reopens the same root incident with a new revision.

### Anti-infinite-loop guarantees

Per incident: configurable max decomposition depth, maximum children, parallelism, total cost/CPU/runtime budget, retry quota and exponential backoff. Use a semantic progress measure: previously unverified predicate count, reproducible failing tests, discovered executable capabilities and independent verified transitions. A retry with unchanged input/hash and no changed hypothesis consumes the attempt budget and must not be repeated.

When no branch is executable, the correct state is \`WAIT_EXTERNAL\` or \`WAIT_CAPABILITY\` with an exact watcher/trigger, not “completed”. Sleep until a relevant event or bounded scheduled reconciliation. After budget exhaustion, emit a diagnostic plus next *concrete* intervention, not an endless child tree.

Safety: fail-closed auth, signed source verification, isolated tests, least privilege, idempotency, CAS on graph/state revisions, fencing stale writers, rollback on failed canary, independent QA, explicit owner approval for privileged/irreversible actions. A watcher is not authorized to modify hosts merely because a graph says so.

## Work state machine

\`NEW → DIAGNOSING → READY → LEASED → EXECUTING → VERIFYING → INTEGRATING → VERIFIED → MONITORING\`.

Side transitions:
- \`DIAGNOSING / READY → DECOMPOSED → WAIT_CHILDREN → READY\` on child evidence;
- \`READY → WAIT_CAPABILITY\` and spawn capability work;
- \`READY → WAIT_EXTERNAL\` on a required independent approval;
- \`EXECUTING / VERIFYING / INTEGRATING → RECOVERING → DIAGNOSING\` after a new failing observation;
- \`VERIFIED / MONITORING → DIAGNOSING\` on regression.

\`COMPLETED\` means verified goal closure, not successful automation delivery. \`BLOCKED\` can remain a user-visible flag on a waiting parent but is never an absorbing state or justification to stop available repair work.

## Actual Dante P0 example — checkpoint concurrency

\`goal: persisted Genesis state is monotonic and crash-safe\` → incident: two writers can save the same step and overwrite one another (PR #49/#87). Branch into **lock ownership + fencing**, **CAS checkpoint generation**, **unified transactional payload** and **two-writer/kill/restart test**. These are scoped independent children (or edges between them where truly dependent). Verify stale writer rejection; verify 100+ CPU world→sensory→Genesis→motor→world steps + reboot equivalence after integration. Until there is a real Genesis provider and independent readback, mock tests remain \`TESTED\`, not \`LIVE_VERIFIED\`.

For flaky \`rustc\` CI namespace (#23/#45/#71): fork reproducible minimal environment probe, differentiate runner failure from compiler integration, repair exact root cause in a narrow branch, rerun positive/negative CI. Do **not** mask failure by disabling tests.

For Gauntlet release gates (#35/#37/#36): fork an independent signer/QA runner and authorized MAS delivery adapter only when capability/policy supports it. A human signature requirement remains a narrow approval node; it does not stall unrelated source repairs.

## Four current hourly automations: **one loop, four worker roles**

All workers must read the same canonical \`root_incident_id\`/graph revision, inspect existing PRs and ownership, execute one **measurable progress step**, submit a patch/test/receipt (or a precise waiting trigger), then publish a compact delta. GitHub issue #47 is a temporary human-readable P0 ledger; it is not a transactional lease database. Until a durable CAS Task Pool is deployed, non-overlapping ownership is mandatory.

- **Dispatcher**: reconcile one critical path, decompose, set dependencies, route child to one owner and track resumption. Cannot claim resolution from a comment.
- **Architect**: own one focused contract/implementation branch on a non-overlapping source scope; self-test.
- **Gauntlet**: independently reproduce, test and raise precise repair children; must not self-approve architect's code.
- **Release/Windows**: inspect live target, verify staging/approval/delivery/readback; when a gate fails, create/implement safely scoped *delivery* child work, not endless status messages.

Cadence is a bounded turn of the same loop, not separate strategic plans. Every next run resumes by durable task key, not from the last chat prose. An automation that cannot reach a write-capable, authorized executor must explicitly say \`WAIT_CAPABILITY\` and produce the smallest independently actionable provider-work order; **it cannot pretend the executor exists**.

## Acceptance gates for first usable R01

1. Replay the same incident event twice; exactly one root ID and no duplicate active repair.
2. Missing capability creates a child and the graph still has a path from that child to parent re-evaluation.
3. Every work state is either executable, has children, has a concrete wake trigger, or is independently verified. No terminal \`BLOCKED\`.
4. Two workers on the same task: only one matching lease epoch/revision may mutate; stale receipt is rejected.
5. Inject failed test and canary: repair rolls back (if applied) and the same root reopens with new evidence, without blind retry.
6. Independent tester and real target readback required for closing a deployment predicate.
7. Restart conductor halfway: durable events recover exactly the same active graph and bounded budgets.
8. Run with only Core + one selected optional app: it either provides its advertised contract or degrades honestly; no hidden mandatory Forge/GraphManager dependencies.

## Initial integration order

A. Publish this contract and visualize the loop in Graph Manager (#25).
B. Implement durable Task Pool CAS/fencing/retry and Conductor as separate apps, using the existing Forge R10/R11 **stateless** contracts (draft PRs #73/#75); do not fork their code into a new monolith.
C. Connect approved worker capabilities, GitHub PR/CI, independent Gauntlet and signed Lifecycle. Start with a single minimal CPU P0 checkpoint repair.
D. Prove concurrent writes, reboot recovery and recovery feedback; only then enable broader autonomous repair and staging.

Related: #47, #25, #36, #37, #45, #49, #73, #75, #87, #90. Existing Draft PRs remain unmerged; this design alone does not fix them.
