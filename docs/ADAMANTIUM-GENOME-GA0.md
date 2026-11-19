# Adamantium Genome Architecture — GA0 typed genetic graph

**Status:** source-only, no installed genome loader and NO runtime expression.
Tracks #147. Based exclusively on Universal Graph G0 #143 and #141.

## Genotype / phenotype

Genotype is an independent typed representation of a **catalog of graphs**.
Each chromosome identifies one Graph IR graph. Genes are typed records:

- HeaderGene: exact graph domain/schema version/revision.
- InterfacePort gene: each exposed port, direction, type, semantics and order.
- NodeGene: node identity, kind, capability reference or pinned composite ref.
- NodePort gene: typed socket belonging to an exact node.
- EdgeGene: source/target, separate relation semantics and feedback delay.

Chromosome links are reconstructed via owner/node/port IDs and GraphRef;
they are not opaque DNA strings. Gene ordering is canonical for a given
source graph catalog and preserves **the original vector order** of ports,
nodes and edges. External code, weights, secrets, state and binary artifacts
are intentionally not carried in the genome.

GA0 guarantees **structure**, not the same runtime program output, package
content, actor permission or live host state. Lossless typed conversion is:

`Catalog → encode_graphs → Genome → decode_genome → Catalog`.

Both entry points validate every graph, including unreachable ones; the
decoder only publishes a new Catalog after every chromosome is accepted.
It rejects unknown/duplicate/wrong-kind/out-of-order genes, malformed
GraphRefs, stale child graph revisions, zero-delay neural cycles, invalid
permission↔data relationships and resource limit breaches.

## Lineage / expression

`Lane::Baseline`, `Lane::Acquired`, `Lane::Experimental` are
**non-authoritative metadata**. This GA0 does not support automatic mutations,
inheritance merges, signatures, execution, loading plugins, deducing grants
from permission edges, writing Noosphere, key recovery, distribution or
rolling back real processes. An experiment cannot promote itself to baseline.

Separate future MAS plugins:
1. Genome Storage: immutable content-addressed, signed records, archival
   source/acquired/experiment lanes and observed-at/provenance lineage.
2. Genome Expression Planner: verifies artifacts/dependencies, host budgets,
   typed capability contracts, actor authorization and produces an inert
   installation plan. Lazy expansion allowed if explicitly budgeted.
3. Graph Manager: CAS/diff/policy/rollback of declarative graph snapshots.
4. Signed Lifecycle: performs *approved* installs/activations, readback and
   rollback; real host effects are never triggered by genome decoding.
5. Noosphere: durable history and verified independent backups. Loss of keys,
   user state or binary artifacts is not solved by genomic metadata.
6. GENESIS/ALT/Dante: specialized gene families over the same envelope but
   independent expression semantics. Neural plasticity != network policy.

## Tests

`cmake -S native/genome -B /tmp/adamantium-genome-build -DCMAKE_BUILD_TYPE=Release`

`cmake --build /tmp/adamantium-genome-build --config Release`

`ctest --test-dir /tmp/adamantium-genome-build -C Release --output-on-failure`

The fixture reconstructs five Graphs, including composed MAS program,
GENESIS CPU dataflow/hardware routing, Dante recurrent brain with a two-tick
delay, infrastructure permission relationship and an unreachable graph.
It checks all three lanes, transactional failure, corrupted genes, stale
child revision, illegal cycle/authority edge reinterpretation, deterministic
gene ordinal ordering and a 10,000-node CPU-only roundtrip.

**Not yet provided:** a stable serialized genome format, content hash,
signatures or state archive, a live execution engine, compression ratio,
concurrent mutation/leases, cross-node recovery, and independent QA/merge.
These are separate gates; do not claim "the installed Toolbox regenerated"
from a test of in-memory Graph IR.
