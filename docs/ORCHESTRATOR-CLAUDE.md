# Adamantium Orchestrator + Adamantium Claude — R0

Two independent MAS applications with persistent job snapshots and optional graph-native Claude tool execution. The **Orchestrator is general-purpose**, independent of CodeForge, Claude, Noosphere, a given node, or a fixed tool list. It executes bounded DAG workflows by discovering and invoking **authorized actions** from the Core capability graph. Claude is an optional asynchronous provider for such workflows.

## Activation

Install through existing MAS app discovery, then grant the `orchestration.read`, `orchestration.execute`, `orchestration.cancel`, `claude.read`, `claude.run`, and `claude.cancel` permissions using the existing owner-approved permissions mechanism. Both apps support `Core + App` boot independently. No auto-activation or deployment is performed by this repository change.

Operator environment settings (never commit credentials):

- `ADA_ORCH_ALLOWED_ACTIONS`: comma-separated *exact* action IDs eligible for orchestration. Every action must also be permitted and currently available in `/api/graph`. The orchestrator excludes self-invocation.
- `ADA_ORCH_MAX_CONCURRENCY`: process-wide simultaneous Core invocations; integer 1–128, default 4.
- `ADA_CORE_URL` and `ADA_TOKEN`: existing local authenticated Core connection.
- `ANTHROPIC_API_KEY`: provider secret.
- `ADA_CLAUDE_API_URL`: HTTPS Messages API endpoint, configured by the operator.
- `ADA_CLAUDE_MODEL`: actual provider-supported model ID, not hardcoded in the app.
- `ADA_CLAUDE_WORKERS`: simultaneous provider requests, integer 1–128, default 4.
- `ADA_CLAUDE_MAX_TOKENS`, `ADA_CLAUDE_TIMEOUT_MS`: bounded provider resources.
- `ADA_CLAUDE_ALLOWED_ACTIONS`: exact comma-separated MAS action IDs Claude may call. Empty by default; no tools exposed.
- `ADA_CLAUDE_AGENT_TURNS`, `ADA_CLAUDE_AGENT_CALLS`: bounded model-turn and tool-call limits (defaults 8 and 16).
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

- **R2 is experimental.** Jobs, step snapshots, and outputs are atomically persisted in the user's private local state directory. Unfinished jobs become `needs_review` after restart and are never automatically replayed. Queue state is not distributed or encrypted at rest by the app itself.
- There is no per-step delegated user identity; execution uses the configured host scope. Keep the action allowlist narrow. Host and provider authorization remains mandatory.
- Claude runs async Messages API generation and optionally a bounded client-side tool-use loop when the job contains `tools: true`. It preserves returned thinking blocks during follow-ups. This is **not** the separate Claude Code CLI or a distributed Claude Code agent deployment.
- High parallelism requires real credentials, provider quotas, rate-limit handling, tracked usage and spending safeguards before production use. An allowlisted action is **not** per-user delegated authorization; the host's configured Core scope is still the effective execution identity.
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

## Claude using MAS tools

Set a narrow `ADA_CLAUDE_ALLOWED_ACTIONS` allowlist in the host's private configuration. Submit a Claude job with `{ "prompt": "Find incident context and summarize it", "tools": true }` to `claude.start`. Claude discovers only matching authorized action nodes from the live Core graph. For example, a memory provider can expose a compatible `memory.search` action; the provider's actual ID must be discovered, never assumed. Each tool result is returned as an Anthropic `tool_result` message. Noosphere, CodeForge, tasks, monitoring, and graphical plugins can participate when their corresponding actions are installed and approved.

Tool calls are **off by default** and require both the exact operator allowlist and active Core permission. The maximum number of model turns and tool calls is bounded. A workflow can delegate to Claude via `orchestrator.submit`; Orchestrator itself has no Claude dependency. No actual Anthropic request is made by unit tests.

## Restart behavior

Jobs are written to per-app private `jobs` directories using atomic file replacement. State `queued`, `running`, or `cancel_requested` at boot becomes `needs_review` (unknown execution outcome), without blind replay. Completed job output stays readable. This prevents duplicate side effects but deliberately requires operator reconciliation. Confidential prompts and result data are stored unencrypted by this initial implementation: use filesystem ACLs, disk encryption, retention policies and a future encrypted job-store provider before production use.

Additional tests: `node tests/durable_jobs.test.mjs` and `node tests/claude_agent.test.mjs`.
