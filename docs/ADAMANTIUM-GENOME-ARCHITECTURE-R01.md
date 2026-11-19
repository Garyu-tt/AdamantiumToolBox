# Adamantium Genome Architecture — R01 bootstrap and genotype / phenotype boundary

**Status: source-only design + reversible typed codec. NOT a bootloader, compiler, mutation engine or deployment permission.**

GENESIS can describe and eventually rebuild **GENESIS itself** through the same versioned Universal Graph IR that describes Toolbox programs and Dante neural regions. The key invariant is **self-hosting with a trusted predecessor**, not self-authorization of currently running code.

## Architectural model

```text
Immutable bootstrap (small independent trusted base; pinned signature roots)
        ↓ verifies
Signed original genome + pinned trusted artifacts and backup references
        ↓ GENESIS expression planner (pure, no activation)
Typed Universal Graph IR → Graph Manager / Capability Registry / Policy
        ↓ independently authorized Lifecycle
Phenotype: CPU-first MAS plugins, native services, UI and GENESIS runtime
        ↓ only independently verified candidate changes
Acquired genome (separate immutable lineage) + Noosphere provenance
        ↑ sandboxed proposals in experimental genome, never auto-promoted
```

The genotype is a **program specification / typed graph**, the phenotype is its deployed state and processes. No genome stores credentials, raw model weights, entire private state, TLS keys, hardware identity or installation secrets. Those are separately replicated and access-controlled.

## Code in R01

`apps/adamantium_genome/genome.mjs` is independent of the editor, Rete, network access and any MAS host:

- `encodeGraphGenome(g)` decomposes the **G0 canonical** Universal Graph JSON into typed, ordered graph-header, interface, node and edge genes.
- `decodeGraphGenome(genome)` reconstructs the exact graph structure and rejects tampered/duplicate/misordered genes or a mismatched SHA-256 origin digest.
- `planGenomeExpression(genome)` produces a **non-executable** list of referenced capability types and validation requirements; it does not select hosts, download artifacts, grant rights or start services.
- `proposeGenomeMutation(genome, {geneId,replaceWith,baseRevision})` stages a bounded single-gene **proposal**, never writes to the original genome.
- `previewGenomeMutation` verifies the proposal against its base digest and revision and reconstructs a candidate graph for **review-only** comparison.

Genes have explicit chromosomes `structural`, `interface`, `connection`. The R01 codec is a faithful encoding of existing IR, not additional semantic claims about expression/regulation or learned behavior. The separate layers `original`, `acquired`, `experimental` exist, but R01 **fails closed** on non-empty acquired/experimental layers. Candidate mutations are separate envelopes until an independent promoter exists.

## Self-hosting N → N+1

1. Current trusted GENESIS N reads a signed and pinned candidate genome for GENESIS N+1.
2. Immutable bootstrap verifies the provenance/manifest, G0 structural compiler verifies typed graphs, and policy checks requested capabilities.
3. Artifact manager resolves content-addressed signed code; Frankenstein can optionally compile languages. Genome alone does not reconstruct missing binary blobs.
4. An isolated executor expresses the candidate without replacing the live runtime or changing the original genome.
5. Independent QA compares regression, state compatibility, CPU/RAM/energy budgets, and explicit policy approval.
6. Atomic Lifecycle cutover occurs only with an externally durable, verified rollback point and authorized lease. No automatic rights elevation.
7. On failure, the bootstrap restores the last verified phenotype; on success a provenance-stamped acquired genome version can be promoted.

**A graph containing a node called `adamantium.genome.compiler@1` does not prove its compiler can regenerate its own executable bytes.** R01 tests structural genome round-trip only. A future genuine self-host proof must rebuild reproducible code, compare hashes and execute it under independent validation.

## GENESIS vs Dante

The meta-language can be shared without collapsing runtime semantics:

| Layer | Toolbox phenotype | Dante phenotype |
|---|---|---|
| Genes | Services, capabilities, UI, dependencies | Regions, receptors, synapse patterns |
| Executor | Signed MAS plugins / OS processes | Neurodynamic step / chemical kinetics |
| State | Noosphere, service state, credentials by external vault | Memory traces, activations, chemistry by separate runtime |
| Adaptation | Approved deployment improvements | Local plasticity and neurogenesis |
| Safety | Signed authorization, CAS, rollback | Bounds, conservation, state mapping |

**A living neural model is not interchangeable with an operating-system service.** They can use the same graph-genome encoding, but not the same timing model, authority policy or state transition function.

## Review gates

- R01 only does strict-structure checks for fields, ports and endpoints plus a content digest. **It does not replace G0's native structural compiler** for cross-graph recursion checks, delayed-cycle semantics or full security review.
- SHA-256 detects accidental or malicious modification *relative to a trusted manifest*; it is **not a signature** and does not establish provenance by itself.
- No automatic `acquired` promotion. A future plugin must verify signatures, deterministic builds, independent QA, CAS/leases, rollback completeness and per-device compatibility.
- No recovery without independently available artifacts and state replicas. A genome is a recipe, not backup data.
- Avoid adding a hard dependency on GENESIS to the minimal trusted bootstrap. CPU-only startup must work when neural plugins, Rete, Forge, Graph Manager and GPU are absent.

## Tests

Run `node --test tests/adamantium_genome.test.mjs` on Node 22+. Native G0 compiler tests remain separate and must be coupled through cross-language conformance in R02.

Next: signed artifact refs and isolated expression receipts, reversible cross-language fixtures, graph-to-genome canonical codec in native C++17, and a safe inert per-chromosome regulator.
