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

## R02 — Linux KSM opt-in physical-memory probe

New: `experiments/dram/ksm-benchmark.c` + `tests/linux_ksm_probe.test.mjs`.

- Runs only when invoked with `--execute`; default prints an opt-in requirement and does no allocation.
- Bounds: 1–2048 pages per region, 2–4 copies, 0–30 seconds observation. On a 4-KiB-page machine, <=32 MiB of benchmark regions.
- Each copy starts independently allocated, byte-identical, deterministic nonzero pages. Reads `/sys/kernel/mm/ksm/run` (never writes it). Only calls `madvise(MADV_MERGEABLE)` when `run == 1`.
- Parses selected mapping `Pss/Rss/KSM` fields from `/proc/self/smaps` before and after. Reports observed PSS delta, KSM page evidence, host policy flag, and explicit status such as `disabled_by_host` or `no_merge_observed`. A failed/unavailable probe is NOT a measured saving; process-private PSS alone is not a global system-wide memory saving.
- Performs an isolated copy-on-write check and frees all mappings. Requires no root; no change to sysfs or global KSM policy.

```bash
node tests/linux_ksm_probe.test.mjs
cc -std=c11 -O2 -Wall -Wextra -Werror experiments/dram/ksm-benchmark.c -o /tmp/dram-ksm-benchmark
/tmp/dram-ksm-benchmark --execute --pages 256 --copies 3 --wait-ms 3000
```

Initial local isolated-container result: `unavailable_no_sysfs`, `verified_ksm_merging: false`, baseline and after `pss_kb:3080` on 3×256 pages; therefore **no physical savings demonstrated yet**. This result does not characterize the user's servers.

Next independent QA: prove KSM-backed page sharing with enabled host policy on a disposable isolated test VM, stress page changes and migration, measure per-page overhead, verify stable latency and no cross-tenant sharing. The provider itself is not installed.
