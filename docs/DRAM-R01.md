# DRAM R01 — Deduplicated RAM

Status: **tested CPU userspace model and Linux memfd COW proof**, **NOT** an installed MAS provider or a system-wide automatic RAM deduplicator.

Tracked by https://github.com/Garyu-tt/AdamantiumToolBox/issues/114

## Goals
- Share identical logical memory pages without decompressing an archive on reads.
- Isolate writes with copy-on-write; preserve each consumer's bytes.
- Separate RAM deduplication from DedupArc storage, DVRAM, microkernel, Noosphere, and any specific OS deployment.
- Treat 17x archival improvement reported by the owner as a different experiment, never as a verified RAM gain.

## Files in this PR
- standards/memory/dedup.mjs — deterministic bounded userspace *model*: SHA-256 candidate hashes plus required exact-byte comparison; per-tenant namespaces; immutable canonical pages; explicit COW; direct byte-read API and safe copy-out API; limited page and handle counts.
- tests/memory_dedup.test.mjs — identity, byte preservation, COW, colliding hashes, per-tenant isolation and failure-atomic budget tests.
- experiments/dram/memfd-alias.c — Linux real virtual-memory proof: four MAP_PRIVATE aliases share one initialized memfd page before one private write triggers OS-level COW; no root or persistent configuration changes.
- tests/linux_page_alias.test.mjs — compile/run test on Linux when a C compiler exists; skip when unavailable.

Run from repo root:

    node tests/memory_dedup.test.mjs
    node tests/linux_page_alias.test.mjs

## What the measurements mean
Model stats describe logical page bytes, canonical page bytes, and **estimated metadata**. They do NOT measure physical host RAM, RSS/PSS, KSM merge rates, or throughput. A negative net estimated saving is possible and is an honest result. The Linux memfd probe confirms direct memory accesses and COW separation; it DOES NOT automatically find independently allocated duplicate pages or prove a specific physical RSS reduction.

The normal safe read-copy API allocates an output copy; the direct byte accessor is a model API, not transparent ordinary CPU-pointer access. The native memfd probe provides actual direct CPU pointer reads without decompression.

## Follow-up native gates
1. Typed independent MAS memory provider contract and honest capability state; keep the microkernel unaware of optional implementations.
2. Opt-in Linux KSM/MADV_MERGEABLE benchmark with controlled workloads, default-off, no host-wide KSM setting changes, and a baseline using no merging.
3. Repeat benchmarks for duplicated weights, zero pages, mixed real workloads, random pages, mutable pages; record measured host PSS/RSS, page scan CPU, latency, COW rate, and metadata.
4. Guard concurrency, lifecycle, allocator ownership and trust domains; cross-tenant memory content sharing remains disabled by default.
5. Run independent QA and architecture tests before any staging/deployment. Private configs and privileged implementation belong in the authorized private boundary.

No simulated saving figure can be presented as a live machine measurement.
