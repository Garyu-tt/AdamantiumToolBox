# Adamantium Claude — graph-native agent mode

## Claude using MAS tools

Set a narrow `ADA_CLAUDE_ALLOWED_ACTIONS` allowlist in the host's private configuration. Submit a Claude job with `{ "prompt": "Find incident context and summarize it", "tools": true }` to `claude.start`. Claude discovers only matching authorized action nodes from the live Core graph. For example, a memory provider can expose a compatible `memory.search` action; the provider's actual ID must be discovered, never assumed. Each tool result is returned as an Anthropic `tool_result` message. Noosphere, CodeForge, tasks, monitoring, and graphical plugins can participate when their corresponding actions are installed and approved.

Tool calls are **off by default** and require both the exact operator allowlist and active Core permission. The maximum number of model turns and tool calls is bounded. A workflow can delegate to Claude via `orchestrator.submit`; Orchestrator itself has no Claude dependency. No actual Anthropic request is made by unit tests.

## Restart behavior

Jobs are written to per-app private `jobs` directories using atomic file replacement. State `queued`, `running`, or `cancel_requested` at boot becomes `needs_review` (unknown execution outcome), without blind replay. Completed job output stays readable. This prevents duplicate side effects but deliberately requires operator reconciliation. Confidential prompts and result data are stored unencrypted by this initial implementation: use filesystem ACLs, disk encryption, retention policies and a future encrypted job-store provider before production use.

Additional tests: `node tests/durable_jobs.test.mjs` and `node tests/claude_agent.test.mjs`.
