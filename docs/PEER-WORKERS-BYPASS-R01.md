# Peer Workers Bypass R01 — five independent developers

Status: temporary bypass until a live Graph Manager / Task Pool / Conductor provides real routing. **Not** proof of five continuously running processes.

## Goal

Five **equal generalist developer agents** work on one repository, `Garyu-tt/AdamantiumToolBox`, and the same GitHub Issues/PRs backlog. No dedicated dispatcher, no permanent architect/coder/tester/releaser roles and no master-worker chain. Every worker may investigate, plan, create a fix, run tests, review someone else's change and accept it when independent evidence and project gates are sufficient.

The workers are **not servitors**. Each receives a target goal, chooses its own viable subtask and approach, adapts to new evidence, and can research, propose a new provider or develop tooling when current capabilities are insufficient. Do not impose a detailed execution script or force only one tiny change per run. Safety and authorizations remain externally enforced.

## Shared simple queue

GitHub Issues + PRs are the temporary task manager, not a distributed transactional database. The **same visible queue** and commit SHA are the source for all five. Prioritize P0 Dante closed loop and dependencies; then non-blocking project work. Any worker can take any READY work; it should prefer a different file scope from currently active branches. Don't wait for the dispatcher or the owner to assign work.

Suggested minimal task notation in issue comment or PR body:

```
TASK <issue-number>/<subtask>
owner: peer-1 | peer-2 | peer-3 | peer-4 | peer-5
scope: files/modules, base SHA
goal: single acceptance predicate
state: CLAIMED | IN_PROGRESS | REVIEW | ACCEPTED | WAIT_EXTERNAL
branch: peer/<id>/<topic>
evidence: test command, logs, SHA, verification
next: concrete next step
```

Only create child issues when a real independent workstream or missing capability warrants it. Avoid busywork and status reports.

## Work cycle for every peer

```text
scan current issues and PRs
  -> select highest-value unowned, independently executable task
  -> claim with peer-id and scoped branch
  -> investigate, implement, test, iterate autonomously
  -> publish PR with reproducible evidence
  -> select a different worker's PR to review when appropriate
  -> second peer independently verifies (test/review/readback)
  -> accept or request fixes (or merge only if explicit project policy permits)
  -> update shared backlog, immediately choose next task
```

Every worker can be an author or reviewer. **No one self-accepts the same change**; any one of the other four may provide the independent acceptance. Explicitly separate review approval from deployment authorization, signing, destructive actions and privileged host changes. GitHub controls and branch protections remain binding. If a worker cannot execute a task due to missing permissions, it chooses another ready task and leaves a precise reactivation condition.

## Lightweight collision avoidance — no fake locks

Before taking a task, read existing issue claims and in-flight PRs; announce `CLAIMED peer-N, scope, base SHA`, then refresh the issue/PR once to catch concurrent claims. If a collision exists, the later claimer yields or both agree on separate scopes. Before publishing, rebase/verify source revision and run tests. Do not claim that GitHub comments implement CAS/leases.

True multi-host atomic assignment and lifecycle receipts can come later via Task Pool. Until then, keep one source-owning peer per code scope and separate reviewers. Workers may coordinate via existing PR comments, not private chat memory.

## BLOCKED is a request to act

When work stalls, reproduce the smallest failure and try a safe authorized repair. If it is too large, decompose into independent testable work. If a capability or tool is missing, create a focused provider/tool branch. If waiting for approval, record exact scope, approver, dependency and trigger, then **switch to another READY task**. Do not stop working merely because one item is blocked. Avoid endless retries and arbitrary recursion; consume explicit time/cost budgets and change hypotheses when evidence contradicts them.

## Shared peer review

- Peer A authors `peer/a/... ` and supplies test evidence.
- Peer B, C, D or E may independently run tests and approve or request changes.
- Peer A must incorporate failed review and rerun.
- Any qualified independent peer may accept under project policy; **no designated chief approver**.
- QA does not equal production deployment. Signed release, owner approval where required, and live readback stay mandatory.

## Scheduling and honesty

The five ChatGPT automations may be configured to the **same hourly trigger** and allowed to work freely during each invocation. The scheduling service may delay or serialize them; hourly scheduled tasks cannot guarantee simultaneous or continuous execution. Never describe them as five always-on processes unless a real long-running worker runner exists and is verified.

A true continuously operating five-agent pool requires five independently executable agent sessions/processes connected to the same queue and permissioned tool interfaces, with runtime supervision. Build that as a small separate MAS-compatible runner when live capabilities are available; do not make Conductor/Graph Manager a prerequisite for this temporary bypass. Distinguish **configured** from **running**.

## Exit from bypass

Retire bypass only after a real dynamic task router has demonstrated: durable work item IDs, ownership collision prevention, permission-aware capability matching, independent review, restart recovery and identical work outcomes during cutover. Preserve GitHub tasks/PRs and evidence. No forced rewrite or app monolith.

Related: #47, #25, PR #92, `docs/RECURSIVE-RECOVERY-CYCLE-R01.md`.
