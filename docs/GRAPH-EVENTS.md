# Graph Change Notifications (C04 / additive MAS 1.0)

`GET /api/graph/events` is the **Core-owned** authorized graph revision
stream. It is not an optional broker and does not introduce a new service.

- Authorization: the same local bearer header as `GET /api/graph`.
- Transport: HTTP text/event-stream, no query-string token.
- Payload: `event: graph_changed` and JSON `{ "revision": "<sha256>" }`.
- Revision: SHA256 of the actual authorized graph document.
- Meaning: **invalidate and refetch** `/api/graph` and `/api/navigation`.
  The stream does not carry action parameters or application state.
- Current implementation samples live graphs only while subscribers exist;
  sampling is shared across subscribers and bounded.
- Client: `shell/graph_events.js` uses authenticated fetch and reconnects.
  `shell/shell.js` serializes refresh calls to avoid concurrent UI rebuilds.
  The existing 12-second poll remains a compatibility fallback.
- Raw UI works with no provider/Composer and with events disabled.
- All actions still require authorization and live re-resolution by Core.
  A UI event is **not** permission to invoke.

## Limits and follow-ups

The stream is a **change hint**, not a durable message queue, event bus or
source of truth; do not use it for task delivery or audit records. A reconnect
must refetch state, not replay an action. It does not currently observe changes
to `interface/` reference files unless the backend graph also changes; LinkFS
refresh still runs on the fallback poll. A Core that loads `ADA_CAPS` only at
startup needs a controlled restart to apply changed permission policy. The
new stream does not claim live policy reload or distributed node membership.

A configurable sampling interval `ADA_GRAPH_EVENT_POLL_MS` is clamped to
250–15000 ms; default 1500 ms. An idle Core performs **no SSE polling**.

Acceptance: `node tests/graph_events_runtime.test.mjs`, source-budget and
architecture checks, `node tests/isolation.test.mjs`, and full CI.
