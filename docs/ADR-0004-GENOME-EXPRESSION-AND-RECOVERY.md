# ADR-0004 — Genome expression, proof and regeneration boundary

Status: **PROPOSED**; GA0 #149 is only a typed reversible graph codec.
Parent architecture: Universal Graph IR #141/#143; genome #147.

## Decision: split genotype, expression plan and observed phenotype

- **Genotype**: immutable signed gene graph; versioned parent lineage, typed
  graph references, pinned source/artifact digests and environment predicates.
  It never contains secrets, generated code authority or runtime privileges.
- **Expression plan**: deterministic, bounded, *inert* build plan compiled
  against verified artifacts, policy, hardware and resource budgets. A plan
  is not evidence that anything was installed or executed.
- **Phenotype**: actual services, processes, interface modules, neural
  structures and distributed nodes. A separate readback/attestation receipt
  proves what ran and with which artifact digests; observations can expire.

### Gene families (independent MAS providers)

| Family | Example | Who interprets it |
| --- | --- | --- |
| Structural | regions, services, graphRef | Graph Manager |
| Functional | capabilityRef + artifact digest | Registry / Executor |
| Regulatory | activation condition + budget hint | Policy + Planner |
| Interface | view module + typed port projection | UI MAS adapter |
| Relational | typed data/control/route/permission edges | Domain-specific adapter |
| Recovery | backup ref, last verified image, dependency pin | Lifecycle + backup MAS |
| Neural | region, receptor, delayed signal, plasticity rule | GENESIS/Dante |

All interpretation is **domain specific**: a neural signal cannot turn into
a network grant or a programmatic write just by changing an edge label.

## Minimal independent bootstrap — no self-authorizing loop

1. Independently installed bootstrap verifies root trust, genome signature,
   package hashes, pinned schema and revocations before decoding any plan.
2. GA0-style compiler converts authorized graph *definitions* into Universal
   Graph IR without starting processes. Missing required binaries or keys
   yield a precise diagnostic, not a synthetic recovery claim.
3. Planners discover compatible CPU/GPU/NPU hosts and resources, expand
   required subgraphs lazily, and produce a declarative dependency DAG.
4. Separate authorization issues scoped, expiring rights. Graph permission
   edges are **descriptions**, not tokens. No execution by the editor.
5. Signed Lifecycle performs install/upgrade only with explicit transaction
   leases and rollback; verifies post-deployment readback independently.
6. Genome promotion requires independent QA receipt, baseline parent ID,
   a monotonically versioned compare-and-swap and permission to promote.
7. Noosphere persists provenance, historical validity and immutable plans;
   at least two independent backup locations are required for recovery.

## Genomic lines

- Original: pinned, reproducible, externally signed, rollback anchor.
- Acquired: append-only verified deltas; never destructively change original.
- Experimental: local/quarantined candidates, CPU-first measured benchmarks.
  A good score alone does not approve a mutation or mutate a running host.

## Regeneration: what can and cannot be recreated

Recovery is possible only when the signed genome, executable/artifact blobs,
trusted bootstrap, decryption keys (from an independent authorized vault),
and required user state snapshots can actually be accessed. Recovery may
select a compatible alternative host, or report what is missing. Graph-only
reconstruction proves neither full service availability nor data restoration.

## Remaining verifiable acceptance gates

GA1: one language-neutral deterministic serialized wire format and
cross-language golden fixtures for native #149 and JS #148; content digest
rules and signature validation, no implicit object property ordering.
GA2: typed regulatory/recovery genes + pure capability/host compatibility
planner; exact source epoch, artifact proofs and a side-effect-free plan.
GA3: experimental/acquired overlays; CAS, self-host bootstrapping in a
sandbox and independent tests; no recursive infinite installation.
GA4: signed Lifecycle controlled installation, power-failure rollback,
readback and multiple independent copies; no implicit remote access.
GA5: specialized GENESIS/ALT and Dante families with distinct expression
engines and performance measurements on existing CPU-first hardware.

Do not claim the system is self-reproducing until a fresh isolated host
can reconstruct a deliberately deleted *noncritical test* component from
independent signed inputs, with state checksums and replayable evidence.
