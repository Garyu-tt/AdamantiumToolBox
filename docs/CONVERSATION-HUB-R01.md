# Conversation Hub: LibreChat-inspired MAS composition (R01)

Status: implementable prototype; not a LibreChat fork, exact pixel clone, LLM backend, or deployed release.
LibreChat reference: https://github.com/LibreChat-AI/LibreChat (MIT at review time).
No upstream LibreChat code, graphics or trademarks are copied in this stage.
Future imports must retain each original copyright and license notice.

## Rule
Independent plugin -> recursive module -> component. UI is a projection of the
*authorized live* capability graph, not of a static menu. Core remains unchanged.
All services must pass Core + App isolation. Any absent module simply disappears.

## R01 independent MAS apps
- `chat_store`: append-only JSONL durable event store, read and write commands,
  independent of browser and model; no automatic pruning on 10-message boundaries.
- `chat_threads`: independently mountable thread listing and creation widget.
- `chat_messages`: independently mountable message history widget.
- `chat_composer`: independently mountable input widget. Saves user messages only.
- `chat_folders`: independent generic object-folder storage and widget.
- `chat_mcp`: discovers allowed MCP resources; does not invent or launch tools.
- `chat_workspace`: composite application built from graph-advertised widgets.

## Composition protocol
Any MAS view may contribute {schema:'mas-composite-view-1',
 surface:'conversation',slot:'navigation|content|composer|tools|context',order:N}.
The composite app publishes `mas-composition-1` with ordered slot descriptions.
The resolver intersects surface, authorized live views, and allowed slots;
modules are loaded by their Core-generated same-origin asset entry.
A contribution can also be opened independently by the existing shell.
The host re-evaluates graph changes; missing/revoked widgets unmount.
The live shell already refreshes its API graph periodically; reconcile is polling,
not yet an event-driven hot-update guarantee.
These protocol identifiers are bootstrap schema identifiers, not fixed plugin IDs.

## Conversation storage contract
`conversation-store-1` resource advertises typed action names rather than
forcing clients to import `chat_store` directly. Client operations have UUID
`opId`, reused for idempotent retries. Messages are durable before acknowledgement.
`read` is bounded to 200 messages per request; cursors support later paging.
The JSONL journal is local single-writer prototype: no distributed transactions,
backup, encrypted store, multitenancy, concurrent-process lock or HA claims.

## Delivery backlog (independent MAS capability groups)
- R02: LibreChat UI parity; navigation/search, rich message renderer,
  markdown/code blocks, keyboard/accessibility, settings, themes.
- R03: model providers (official APIs and local engines), transport streaming,
  cancellation, tool calls, citations, attachment and artifact adapters.
- R04: durable inbox, interruption state machine, versioned context snapshots
  every ten messages without deleting originals, CR10 import/export.
- R05: Task Compiler, task pool, Graph Manager, agent review/QA, evidence.
- R06: projects, per-project permissions, folders, MCP management and dynamic
  slot embedding across IDE, desktop, and other MAS applications.

## Non-goals / restrictions
- Do not claim a full ChatGPT/LibreChat replica or access to native ChatGPT
  private project state via browser automation.
- Browser MAS is optional; site interactions require user-granted permissions
  and must respect platform terms. Browser is not a reliable model transport.
- No hardcoded VM, domain, provider, API key, optional plugin, navigation entry,
  model name, renderer, theme color or node topology.
- Never promote a prototype without tests, signed release review and rollback.

## R02 incremental implementation: interruption and checkpoints (2026-11-19)
Two **optional**, Core+App-independent MAS applications extend the R01 shell:

- `chat_turns` (`conversation-turns-1`) stores committed user-message references
  and generation claims. New input during a claim marks it `interruptRequested`.
  A stale completion cannot be committed; superseded or failed work preserves
  all unconsumed inputs. The model adapter must acknowledge cancellation.
- `chat_context` (`conversation-checkpoints-1`) stores versioned, SHA-256
  content-hashed summaries with source IDs and producer. `due` determines
  whether 10 more thread messages have accumulated since the last snapshot.
  A model-backed context compiler is not part of this prototype.

The composer uses a stable operation ID for ambiguous retries. An independent
turn widget can reconcile message receipts from the durable chat store when a
cross-plugin registration fails or a browser session ends unexpectedly.

Limitations: single-process JSONL ledgers, no full LibreChat UI parity, no
live model transport or actual model cancellation, no agent execution,
no background reconciliation and no cross-node transactional guarantee.
New capability permissions must be explicitly authorized.

Tests: `node tests/conversation_hub.test.mjs`,
`node tests/conversation_turns_context.test.mjs`,
`node tests/conversation_services.test.mjs`.
