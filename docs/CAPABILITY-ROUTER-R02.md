# Capability router R02 (experimental)

Core has a generic provider registry independent of Noosphere and Database. Action graph nodes may advertise semantic `capability`, `capabilityVersion`, and `operation` (read or write). Core discovers eligible providers from the live graph, not a fixed application list.

An authorized caller can request `POST /api/invoke` with `{"capability":"storage.graph.read","version":"1.0","operation":"read","params":{"namespace":"demo"}}`. The legacy concrete `action` request remains supported. `GET /api/capabilities` lists currently registered visible providers.

Routing uses same-major, sufficient-minor version matching and Core-granted scopes. Reads select deterministic priority/order. Writes require exactly one primary or an explicitly selected provider/node. No automatic retries after an uncertain error. Pinning a node forbids automatic failover. Disabled/unavailable actions are absent from the registry.

Current Core graph integration registers **local** app services only. The generic registry has a guarded remote-provider registration API, but this is **not remote mesh discovery** or verified network transport. A trusted mesh controller, not a plugin request or HTTP client, must supply approval and proof of pre-pinned identity. Remote endpoint validation, caller-bound delegation, per-tenant ACL, lease checks, health tracking, transaction idempotency, and replication are required before real remote writes.

Noosphere 3.0 will consume semantic storage contracts. Its plugin must not contain a database or own Database's data directory. Core + Noosphere alone should start in reduced mode; absent storage means unavailable memory writes.

Validation: `node tests/capabilities.test.mjs`, `node tests/capability-discovery.test.mjs`, existing Database tests and full repository gates before merge/deployment. No legacy data was accessed.
