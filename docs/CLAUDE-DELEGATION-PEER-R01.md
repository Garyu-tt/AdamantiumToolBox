# Claude-assisted peer worker batching R01

Status: operating contract for five equal AdamantiumToolBox workers; not proof that a live authenticated Claude API/CLI is reachable. Complements `docs/PEER-WORKERS-BYPASS-R01.md` and `docs/RECURSIVE-RECOVERY-CYCLE-R01.md`.

## Principle

Each of the **five peer developers** stays an autonomous generalist. Claude Code / the verified Claude bridge is a *tool provider / delegated coder*, not a sixth boss, not a fixed dispatcher, not a replacement for independent acceptance. The peer can itself code, test, review, and choose tasks; it decides per task whether local edits, Claude delegation or another compatible provider are most efficient. If the bridge is unavailable, the peer keeps working rather than reporting terminal BLOCKED.

## Candidate batch per peer invocation

1. Fetch fresh GitHub Issues + PRs and existing claims; infer ready dependency leaves. Check open PRs and current source/head SHA; avoid work already in progress.
2. Pick **1–10 independently verifiable, bounded tasks**, prioritizing validated P0 blockers. Ten is a *throughput experiment / upper batch-size*, not a quota. Do not split work artificially simply to reach ten.
3. Group tasks by non-overlapping file ownership, model context and dependencies. For each work package supply stable work ID, goal/predicate, pinned base SHA, allowed paths, constraints, repro/test command, budget and expected evidence. If a task's output is a prerequisite for another, execute them sequentially; parallelize only independent tasks.
4. Discover whether an **authorized live** Claude Code, Claude API or Claude bridge capability is currently available. The previously tested bridge self-test and a responsive host do not prove live model access, valid credentials, safe billing or permission to run paid calls. Never invent endpoints, access tokens, success, or a signature.
5. Under an explicit configured spending budget/approved entitlement, send one or more bounded job packets via the approved provider. Prefer cheapest adequate executor based on real outcomes, with per-task and total batch caps on cost, tokens, duration and concurrent requests. Do not assume old balance figures are current or grant unlimited API spending. If no approved paid-use policy exists, do not call a billable endpoint; create a narrow configuration/approval task and keep working on locally executable tasks.
6. Require Claude responses with exact `task_id, base_sha, patch_sha, changed_files, tests, logs, failures, remaining_risk`. A textual "done" is not evidence of code change. Apply proposals only after source scope and current SHA recheck; never overwrite concurrent work. Run reproducible tests independently of model claims.
7. One peer authors; any *different* peer may independently review/accept, subject to branch protections and release policy. No self-approval; code review is not permission for production deployment. Failed tests become repair work in the same recursive loop. Save output and recheck parent graph.
8. Continue selecting ready tasks while time and permitted budget remain. Never spend whole invocation only reporting blockers. If a provider/tool is absent, create or claim the smallest provider-repair task, but do not halt unrelated work.

## Claude delegated job packet

```json
{
  "work_id": "issue/subtask/attempt",
  "root_incident_id": "stable-root",
  "owner_peer": "peer-1..peer-5",
  "repo": "Garyu-tt/AdamantiumToolBox",
  "base_sha": "<current verified source SHA>",
  "scope": ["explicit non-overlapping files"],
  "goal": "measurable acceptance predicate",
  "reproducer": "command or fixture",
  "tests": ["targeted test command", "necessary regression command"],
  "execution": {"mode": "isolated", "sandbox": true},
  "budget": {"cost_cap": "approved policy value", "timeout": "approved policy value"},
  "delivery": ["patch", "commit sha", "test evidence", "risk notes"]
}
```

This is a **logical contract**, not an implemented Claude transport API. Actual wire schema must be negotiated with the discovered provider. Never send secrets or private Noosphere/user data into external model requests without separate authorization; minimize code/context scope.

## Batch and collision safeguards

- Global batch-wide duplicate detection: `repo + issue/work_id + source SHA + file scope`.
- GitHub comment claims are advisory, not transactional leases. Verify overlap against live PRs immediately before write; yield on ambiguous collisions. Later Graph Manager/Task Pool should provide CAS + fencing.
- When a task requires shared files, assign one writer; delegate other tasks as research/review or serialize.
- One Claude response containing ten fixes must not be merged as an opaque bundle: separate ownership/evidence/review per task. One large patch with ambiguous acceptance is a failed batch.
- A model hallucination, stale patch, failed sandbox, excess cost or unknown write outcome closes *that attempt*, not the parent incident. Retry only on changed evidence or a new hypothesis, within limits.
- If CI or reviewers disagree, preserve failure evidence and reopen root, not auto-accept green-looking model prose.
- Prefer real compatible existing Claude bridge/provider over reimplementing Claude integration. If needed, build a thin MAS Claude adapter as an isolated capability; no new hardcoded Core dependency.

## Definition of useful progress

Count separately: tasks selected; tasks delegated; validated source patches; passing independent tests; accepted PRs; verified deployed fixes; cost/time. Avoid equating "10 prompts" or "10 comments" with 10 solved issues. Evaluate actual verified fixes per hour and cost per accepted fix.

Success criterion: under a permitted live Claude bridge, at least one peer can take an unclaimed GitHub task, delegate a bounded implementation packet, receive a real patch, rerun tests, get another peer's independent review, then take the next ready task without owner intervention.

Related: [bypass](./PEER-WORKERS-BYPASS-R01.md), [recovery loop](./RECURSIVE-RECOVERY-CYCLE-R01.md), PR #92, #47, #25.


## Repository routing note — Adamantez R01 (additive; original worker policy unchanged)

Use the public `Garyu-tt/AdamantiumToolBox` repository for redistributable code and public contracts; use the separately controlled **private** `Garyu-tt/AdamantezTolls` repository for nonpublic plugin/server implementations, only when authorized. Classify task output PUBLIC / PRIVATE / RESTRICTED before creating a patch or delegated job. Do **not** put closed source, secrets, user data, private workspace contents, privileged CI artifacts or credentials into public branches, PRs, logs or model prompts. The public client can consume sanitized authorized capability contracts; an unavailable private provider is not a reason to invent access or stop unrelated work. A branch/worktree is not a repository permission boundary. Preserve existing five-peer roles, schedules, Claude delegation, independent QA, no-blocker recovery and current task selection unchanged. Architecture reference: `docs/ADAMANTEZ-SOURCE-BOUNDARY-R01.md` on `design/adamantez-source-boundary-r01` (until merged).
