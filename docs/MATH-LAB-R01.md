# Mechanicus Math Lab R01 — mathematics research department

Status: experimental MAS application, source and CI only. Not an active research organization, not a running multi-agent laboratory and not a production codec.

## Mission

Provide a reusable CPU-first mathematical research department inside Mechanicus. Agents formulate hypotheses, apply mathematics to engineering datasets, calculate complete representation cost, falsify claims, preserve evidence, and reuse discoveries across projects. Compression is first priority, but not the scope limit.

### Department roles

| Role | Responsibility | Evidence |
|---|---|---|
| Literature analyst | Find primary sources, definitions, assumptions, licenses | Source and theorem cards |
| Mathematical theorist | Construct hypotheses and proof obligations | Hypotheses and counterexamples |
| Experimentalist | Perform bounded deterministic tests on approved datasets | Source hash, configuration, measurements |
| Independent reproducer | Repeat with another decoder/tool/seed | Reproduction receipt |
| QA auditor | Compare baselines, regression corpora, resource limits | Pass or reject with evidence |
| Noosphere archivist | With separate permission, archive validated work | Provenance, timestamps, rights and lineage |

These are contracts for future Task Pool/Orchestrator workers, NOT deployed agents. Task Pool remains the work-order owner, Orchestrator executes authorized workflows, Graph Manager displays progress, Noosphere stores only separately authorized records. No mathematical theorem or graph link confers MAS permissions.

### Cross-project programs

- Compression / archive: entropy, predictive coding, reversible algebra, number theory, bit layouts and graph compression.
- ALT: exact vs approximate weights, low-rank factors, MoE experts, I/O, memory and speed budgets.
- GENESIS: genotype and phenotype reconstruction, deltas, error-bounded residuals and model-description costs.
- Noosphere: temporal graph indexing, provenance, search and compressed representations.
- Graph brain / Sanctuary: graph invariants, CPU-first simulations, spectra and reversible state serialization.
- Toolbox / network: combinatorics, scheduling, optimisation and risk estimation.

### Scientific workflow

Hypothesis -> source/rights verification -> dataset approval -> derivation -> bounded experiment -> exact reconstruction (or explicit lossy distortion calculation) -> independent rerun -> counterexample tests -> MDL comparison -> independent QA -> permitted Noosphere archival -> new hypotheses.

The experimental engine must never report external QA success when only local roundtrip checks passed. Missing evidence creates a blocker for independent verification through the normal authorized task workflow; Math Lab is not a new queue.

## First method: RootTransform

The root_transform module performs a strictly lossless integer-only transformation on bounded unsigned binary data blocks:

    N = a^k + r, a = floor(N^(1/k)), r = N - a^k

It searches various integer root degrees, including selected large degrees, and can recursively represent the base and remainder within fixed CPU budgets. Its on-wire representation contains version header, original byte length, node tags, degree values, nested values and exact residuals. Leading zero bytes survive decoding. A strictly smaller encoded stream is returned only after counting ALL transmitted bytes; otherwise the original block is preferred.

The decoder is separate, bounded and rejects invalid framing, nonminimal integers and incorrect remainders. All root arithmetic is exact; floating point is used only for reporting empirical Shannon histogram entropy, never for reconstruction.

For uniform random strings, no lossless codec can always reduce data size. The binary representation of 10^1000 may be unusually compressible while the ASCII decimal text with a thousand zeros responds better to zlib. Leading-zero simplification is not proof of a new compression mechanism.

### MDL accounting

    L_total = L_model + L_parameters + L_payload

For fair comparisons count stream framing, method identifiers, exponents, nested nodes, exact residuals, and whatever decoder/model costs the archive actually imposes. Shared decoder binaries may be amortized across files only under an explicit distribution assumption. The current engine measures standalone raw/RootTransform/zlib streams and allows an explicit additional model-size charge. It does not yet automatically estimate decoder executable size, archive block headers or rollout costs.

A naive single-byte histogram Shannon estimate does not measure the full entropy rate of a file, and neither it nor short mathematical expressions prove superior compression across arbitrary data.

### Research evidence

The experiment module produces records containing schema, dataset ID, SHA-256 source digest, search budget, candidate byte lengths, extra decoder cost, selected method, savings and reconstruction-check outcome. The independent audit field remains not-performed and production approval remains false. Raw source bytes are not returned and are not persisted.

Hypothesis records contain scope, discipline, claim, dataset ID and literature references. They do not execute anything by themselves.

### Academic foundations

MIT Information Theory and Linear Algebra; Stanford EE276; Matt Mahoney's Data Compression Explained; MIT Mathematics for Computer Science; Peter Gruenwald's Minimum Description Length research; Mathematics for Machine Learning; and established LZ/BWT/PPM/wavelet literature. Each future hypothesis needs specific source provenance, licensing and validity assumptions. No automatic scraping or use of unauthorized private corpora is enabled.

## MAS contract and isolation

The plugin is independent and must be activated through approved MAS lifecycle.

- math_lab.read: catalog and UI.
- math_lab.experiment: CPU-only bounded experiment on explicitly supplied binary data.

The service binds to loopback, requires ADA_INTERNAL_KEY and does not grant itself permissions. Host-delegated UI calls are restricted to capabilities visible in the current Core graph. No credentials, direct server address, arbitrary code execution, filesystem or private API operations exist inside the experiment engine.

The MAS service limits inputs to 2048 bytes, 16 root degrees, 40 root calculations and depth 2. It does not start research agents, write work orders, mutate production archives, persist user data or execute untrusted code.

Run:

    node --test tests/math_lab.test.mjs tests/math_lab_service.test.mjs

The plugin is an experimental R01 candidate and requires independent QA, fuzz testing, corpus benchmarking and Lifecycle review before a real deployment.

## R02 and beyond

1. Separate adversarial decoder fuzzing and independent deterministic reproduction receipts.
2. Typed DAG of alternative reversible transforms (roots, differences, predictive coding, bit layouts, finite-field operations, spectral and graph methods), strictly bounded by computation and full MDL.
3. Separate lossy rate-distortion tracks for ALT/GENESIS with real accuracy testing.
4. Authorized Noosphere mathematical literature indexing and provenance checks.
5. Task Pool and Orchestrator role workflows with visible scientific QA, Fixiki blockers and archival approvals.
6. Optional archive codec negotiation and per-block compatibility; no changes to existing DARC format without review.
7. Resource-aware optimisation of CPU time, memory, energy and model/decoder code cost.

No live MAS instance, agent worker or protected archive is changed by this PR.
