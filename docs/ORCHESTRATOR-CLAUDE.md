# Adamantium Orchestrator + Adamantium Claude — R0

Two independent MAS applications. The **Orchestrator is general-purpose**, independent of CodeForge, Claude, Noosphere, a given node, or a fixed tool list. It executes bounded DAG workflows by discovering and invoking **authorized actions** from the Core capability graph. Claude is an optional asynchronous provider for such workflows.

## Activation

Install through existing MAS app discovery, then grant the `orchestration.read`, `orchestration.execute`, `orchestration.cancel`, `ai.claude.read`, `ai.claude.run`, and `ai.claude.cancel` permissions using the existing owner-approved permissions mechanism. Both apps support `Core + App` boot independently. No auto-activation or deployment is performed by this repository change.

Operator environment settings (never commit credentials):

- `ADA_ORCH_ALLOWED_ACTIONS`: comma-separated *exact* action IDs eligible for orchestration. Every action must also be permitted and currently available in `/api/graph`. The orchestrator excludes self-invocation.
- `ADA_ORCH_MAX_CONCURRENCY`: process-wide simultaneous Core invocations; integer 1–128, default 4.
- `ADA_CORE_URL` and `ADA_TOKEN`: existing local authenticated Core connection.
- `ANTHROPIC_API_KEY`: provider secret.
- `ADA_CLAUDE_API_URL`: HTTPS Messages API endpoint, configured by the operator.
- `ADA_CLAUDE_MODEL`: actual provider-supported model ID, not hardcoded in the app.
- `ADA_CLAUDE_WORKERS`: simultaneous provider requests, integer 1–128, default 4.
- `ADA_CLAUDE_MAX_TOKENS`, `ADA_CLAUDE_TIMEOUT_MS`: bounded provider resources.
- `ADA_CLAUDE_THINKING_MODE`: `off`, `adaptive`, or `enabled`; use `ADA_CLAUDE_THINKING_BUDGET` for `enabled`.

Without provider credentials, model, or endpoint, `claude.start` is **not published**. There is no fake Claude response or automatic paid API call.

## Generic workflow

Invoke `orchestrator.submit` through Core with this sample `params` object, replacing the illustrative action IDs with real ones discovered at runtime:

```json
{
  "parallelism": 8,
  "steps": [
    {"id":"memory","action":"memory.search","params":{"query":"incident"}},
    {"id":"inspect","action":"ops.inspect","params":{"target":"selected node"}},
    {"id":"claude","action":"claude.start","after":["memory","inspect"],
     "params":{"prompt":{"$step":"memory","path":["content"]}},
     "poll":{"action":"claude.status","intervalMs":1000,"maxAttempts":600}},
    {"id":"report","action":"ops.report","after":["claude"],
     "params":{"body":{"$step":"claude","path":["result","content"]}}}
  ]
}
```

`$step` explicitly references the output of a prior completed step. Configure dependency edges in `after`. Orchestrator permits only actions on the operator allowlist *and* currently granted in the Core graph. Actions such as Noosphere memory access, task-pool claim/submit, monitoring, video/image generation and Claude execution are merely different providers—no hardcoded dependency.

The orchestrator returns `{jobId,status:'queued'}`. Use `orchestrator.status` for results and `orchestrator.cancel` to cancel. Claude has `claude.start`, `claude.status`, `claude.cancel`, `claude.jobs` with identical asynchronous principles.

## Scope and limitations

- **R0 is functional but experimental.** Tasks and results are in-process and lost on restart; no durable encrypted queue yet.
- There is no per-step delegated user identity; execution uses the configured host scope. Keep the action allowlist narrow. Host and provider authorization remains mandatory.
- Claude runs async text generation via its API. This is **not** Claude Code's multi-tool autonomous agent and does not spawn independent Claude Code sessions.
- High parallelism requires real credentials, provider quotas, rate-limit handling, tracked usage and spending safeguards before production use.
- No auto-failover or retry for ambiguous writes. Use workflow contracts and explicit operator policy for mutating actions.
- Existing MAS manifests use a fixed bootstrap port for local service registration; Core discovery remains dynamic for consumers.

## Acceptance

```sh
node tests/orchestrator.test.mjs
node tests/claude.test.mjs
node tests/contract.test.mjs
node tests/isolation.test.mjs
python tools/architecture-check.py
```

Local unit tests exercise Noosphere-like retrieval, parallel inspect, Claude queue/status, and report writing with fake providers; no paid API calls occur.
