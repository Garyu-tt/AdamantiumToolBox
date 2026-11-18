# Noosphere 3.0: clean-slate distributed memory (design contract)

Status: R03 stateless standalone Noosphere plugin code exists in draft PR, NOT DEPLOYED. R02 ships local semantic routing; R03 adds envelope validation without persistence. Distributed recovery and legacy migration remain unimplemented.

## Ownership boundary

- **Noosphere plugin**: knowledge graph semantics, memory envelopes, temporal metadata, provenance, retrieval context, life-cycle policies and relationships. It contains no database engine, database credentials or physical storage paths.
- **Database plugin**: journals, snapshots, indices, query execution, storage adapters, durability and replication. Physical Database data directories belong to Database only.
- **Adamantium Core**: recursive modules, capability negotiation, authorization/routing, plugin life-cycle and minimal isolation. Core must not own Noosphere records.
- **Storage provider**: discovered at runtime by versioned semantic capabilities and caller permissions. Provider identity and transport are deployment choices, never hardcoded into Noosphere source.

Core + Noosphere alone must start in reduced mode. Without a compatible storage provider, persistent memory actions are absent or explicitly unavailable; Noosphere must not silently open its own SQLite database.

## Recursive plugin organization (illustrative, discoverable)

```
Noosphere plugin
  memory
    envelope
    relations
    temporal
  ingestion
    deduplication
    provenance
  retrieval
    context
    summarization
  lifecycle
    retention
    migration
  recovery
    manifests
    verification
```

Modules may be further nested, disabled or promoted into independent plugins. Dependencies follow capability contracts, never directory ancestry.

## Memory envelope

Every persisted record needs a stable object ID, schema version, payload reference/hash, provenance, `observed_at`, `recorded_at`, `updated_at`, and optional `valid_from` / `valid_to`. Preserve source IDs and ambiguity; never overwrite conflicting facts solely because their text looks similar. Schemas are versioned and typed; a memory is not assumed to be a plain text embedding.

## Legacy import process

1. Deploy a brand-new empty Noosphere 3.0 namespace in Database. No blind copying of old database files.
2. Discover each legacy Noosphere instance and other archives through read-only adapters; take an inventory and source snapshot.
3. Import one bounded, idempotent batch with source ID, checksum, migration job ID and source provenance.
4. Verify object counts, content integrity, relationships and temporal semantics. Record failed/ambiguous items for review.
5. Test restore from independent Database backup or sufficient erasure-coded fragments, not merely an index.
6. Leave old sources untouched until explicit separate decommission authorization.

## Distribution and recovery invariants

A node may retain only a cache and placement manifest; it is not automatically capable of reconstructing all data alone. Critical durable information needs enough independent recovery material and keys to restore after the specified failure scenario. Replication should avoid excessive churn during temporary outages; distinguish unavailable from definitively lost nodes. Reject conflicting writers unless primary/consensus and idempotency policies explicitly authorize them.

## R03 implementation

The independent `apps/noosphere` plugin exposes `noosphere.status`, `noosphere.modules`, and a stateless `noosphere.validate` action, mapped to `memory.envelope.validate@1.0`. Its recursive envelope module consumes optional separate temporal and provenance validators via typed capability contracts. No DB package is embedded or imported, no storage path is opened, and no memory read/write actions are advertised.

The graph uses the existing shared graph icon until Leonardo produces a dedicated asset. Disabling ingestion removes the provenance validator and blocks the dependent envelope action. Test coverage: `tests/noosphere.test.mjs` and `tests/noosphere-http.test.mjs`.

## Next acceptance gates

- R03: Core + Noosphere independent plugin, no embedded datastore, stateless graph with no fictitious persistent memory actions. Implementation in draft, subject to CI.
- R04: Database-backed CRUD through `storage.graph.*` via Core routing with per-caller identity and ACL.
- R05: read-only incremental legacy adapter plus manifest, provenance and replay-safe checkpoints.
- R06: two independently restorable copies and verified restore drills before durable real-world migration.
- R07: trusted remote provider dispatch through authenticated pre-pinned Mesh identity, with explicit write destination and no ambiguous retries.

No old Noosphere data should be modified by these implementation or smoke-test phases.
