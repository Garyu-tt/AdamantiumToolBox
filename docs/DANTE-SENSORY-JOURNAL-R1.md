# Dante Sensory R1 — durable queue microplugin

**Status: draft source, local CPU tests only.** No live Genesis, no signed activation, no Windows/power-loss QA.

## Contract and composition

- App `dantesensory` is an independently launchable MAS plugin. Owns only a bounded sensor event journal; contains no Genesis, world or UI compositor.
- `dantesensory.publish` publishes action contract `dante.sensory.deliver.v1`. Messages use `dante.sensory.event.v1` as in independent draft PR #46.
- `dantesensory.peek` returns up to 16 *unacknowledged* events without removal. `dantesensory.ack` removes an event only after an explicit durable commit. ACKs remain idempotent within a bounded recent-ID window.
- Journal uses a caller-owned/owner-configured path, SHA-256 record integrity, exclusive temporary file, file fsync + atomic rename, best-effort directory fsync. A corrupt journal fails closed.
- State is bounded by queue capacity, per-event bytes, source key count, age-independent finite sequence IDs and a bounded ACK cache. Backpressure **rejects**, never silently drops.
- It is **at-least-once**, not exactly-once. A process crash after work but before ACK results in replay. Consumers must deduplicate by event ID and ACK **only after checkpointing** their own state.
- The package runs in Core + dantesensory without any other optional app. The capability graph/permission policy controls which actions are exposed. The service itself requires the runtime's internal key.

## Tests
```bash
node --test tests/dantesensory_queue.test.mjs tests/dantesensory_service.test.mjs
node tools/mas-check.mjs
node tests/isolation.test.mjs
python tools/architecture-check.py
```
Local focused tests cover restart, duplicate publish, idempotent ACK, source/queue limits, invalid and oversized payload, corruption fail-closed, concurrent enqueue, escaped JSON size, HTTP auth, MAS graph and process restart.

## Unresolved release blockers

- **Single writer.** No interprocess lease/fencing yet; an operator/supervisor must ensure one service per journal path. Do not run concurrent instances against the same state file.
- **Crash/power-loss.** Simulated process restart has been tested; abrupt power loss, Windows filesystem durability and interruption at each fsync/rename stage still require independent tests.
- **Transactional boundary.** Consumer checkpoint and queue ACK are separate operations; application-level replay/idempotency and a recovery protocol are mandatory.
- **Security.** Core permission filtering and signing must be independently checked. Local storage paths and ownership require host validation before activation.
- Performance is intentionally low-throughput (whole bounded journal rewritten on every mutation). Upgrade to segmented/WAL storage only after the initial closed loop is proven.
- Real Genesis, full sensory→motor loop, signed release/Windows deployment remain unverified.

Related drafts: PR #46 (volatile bus), PR #49 (checkpoint), PR #55 (CPU world), PR #85 (composite app), PR #86 (world adapter). No existing PR source is modified by this work.
