# Factory diagnostics adapter (read-only)

This is an optional MAS viewer, not a Claude/MWAPI worker or queue. It never
contacts providers, starts inference, decides GitHub work or writes to GitHub.
It exposes only observed events from an explicitly configured local NDJSON
file, and refuses to fabricate messages when the file is absent.

## Connect a genuine producer

Set ADA_FACTORY_DIAGNOSTICS_FILE to the file written by the **canonical**
factory runtime. The source must be a regular file readable by the Toolbox
service account. The producer, not this viewer, collects actual provider
replies/tool actions, redacts private content before writing, and maintains
durable storage. Do not use a raw key file, browser profile or unredacted
transcript.

Each complete newline-terminated record has these fields:
- schema: factory-diagnostic-event/1
- at: ISO 8601 timestamp
- agent_id, session_id: stable identifiers
- type: session_start, assistant_message, tool_call, tool_result, github_action,
  error, usage, session_end or heartbeat
- role: user, system, assistant or tool (when known)
- provider, model, text, status: optional
- usage: input_tokens/output_tokens, cost_usd; missing cost stays null/unknown
- github_url: verified GitHub Issue/PR/commit path, optional
- commit_sha: Git commit SHA if independently confirmed, optional

A model claiming to have committed is NOT equivalent to a verified GitHub
commit. The producer must separately record a GitHub API result.
The viewer currently validates URL shape, not remote existence.

Only the last 2 MiB of the file are scanned, with 100 events returned
per request. Incomplete trailing records are ignored. The viewer neither
rotates nor modifies the source log. Production retention, append durability,
full pagination and 20-way correlation still belong to the producer.

## Owner-only control

MAS capabilities are factory.read only. The service binds to loopback,
requires the host ADA_INTERNAL_KEY and has no mutation action.
The frontend renders model text with textContent, not HTML, and redacts
common API keys before display. Regex redaction is defense in depth,
NOT a substitute for producer-side filtering and access permissions.

Test with: node tests/factory_diagnostics.test.mjs

## Known unfinished integration

The live factory service on VM121 has not been reached, the event producer
is not yet wired, the Telegram button is not deployed, and the model bills
are not reconciled. These are separate acceptance tasks in Issue #170.
When no source is connected the UI explicitly shows unconfigured/missing;
it never invents an assistant message or reports spending as zero.


## Existing Claude Code transcripts: offline import

The actual Claude Code CLI can keep full owner-private session transcripts in
its private home under a .claude/projects hierarchy, even if a separate
run output contains only a final JSON result.

To export selected, redacted, verifiable observations for this viewer:

    python tools/factory_transcript_export.py \
      --root /private/factory-home --project PROJECT_ID \
      --out /private/diagnostics/events.jsonl --max-runs 100

The destination directory must be private (mode 0700). The exporter writes
a mode 0600 atomic snapshot. It correlates the final CLI result's exact
session UUID with a transcript filename; no fuzzy session guessing.
It drops Claude thinking, raw user prompts, API-request payloads, tool inputs,
and raw tool result bodies. Only assistant text, tool names, observed tool
result presence, and terminal usage are included. Missing cost is null rather
than 0. A tool invocation is not evidence of successful GitHub mutation.

This is a manual offline migration helper, not a live log producer.
Its output must remain owner-only. No transcript is uploaded to GitHub;
only the code and synthetic tests belong in this repository. To connect the
MAS viewer, point ADA_FACTORY_DIAGNOSTICS_FILE at that owner-private file
on the same authorized host or through an approved private adapter. Never
publish that file or place it in the source tree.

Before enabling automatic refresh or spending more model credits, audit
and reconcile this snapshot against GitHub PRs and the provider's own
billing statement. The exporter does not claim billing accuracy or successful PRs.
