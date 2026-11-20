# Math Lab R02 — Reversible transform search and reproducible verification

**Status:** draft reference, stacked on Math Lab R01 PR #163. No deployment, no production archive integration or agent activation.

## Purpose
Math Lab searches for exact byte representations through a bounded graph of reversible transforms, scoring each *complete wire encoding* against raw, standalone zlib and R01 RootTransform. This is not an exhaustive shortest-program search; it is a deterministic bounded experimental procedure with strict CPU budgets.

## Transform opcodes
| Code | Forward operation | Inverse |
|---|---|---|
| 1 | Current XOR previous byte | Prefix XOR |
| 2 | Current minus previous byte modulo 256 | Prefix sum modulo 256 |
| 3 | Even-indexed bytes then odd-indexed bytes | Interleave using original length |
| 4 | Bit-plane 8×8 transpose, unchanged 1–7-byte tail | Inverse bit-plane transpose |
| 5 | Reverse byte order | Reverse byte order |

These maps preserve the number of bytes and are bijections; they do not directly reduce information content. Their purpose is to expose patterns to subsequent coding. R02 explores a limited number of states and depths, deduplicates identical transformed byte strings and scores a zlib or RootTransform leaf at each explored nonempty path.

## Wire protocol
A complete search-graph frame contains:

    MLG2 | original-length:canonical-varint | step-count:byte |
    step-opcodes:bytes | leaf-codec:byte | payload

Leaf codec 1 is a complete zlib-wrapped stream, 2 is a complete R01 MLR1 RootTransform stream. The original byte count preserves exact leading zero bytes. Invalid frames, unknown opcodes, truncated data, output expansion and noncanonical integers are rejected by the separate reference decoder.

## Scientific accounting
Candidates compared by complete byte totals: raw bytes (no frame), standalone zlib stream, standalone R01 RootTransform stream, or graph frame with all metadata. Additional model costs may be supplied explicitly per candidate; the scorer does not silently assume that decoder binaries, archive registration, model deployment or cross-file amortization are free.

The selected transform graph must strictly beat other methods. Otherwise the result has no graph stream and reports the winning baseline. It is never claimed that all possible inputs compress.

The current budget at the MAS action boundary: at most 2048 input bytes, 24 states, graph depth 2, 8 root calls, 16 root evaluations per call. Search is bounded but *not* globally optimal. No energy measurements or held-out corpus scores are claimed.

## Independently coded reference
The file apps/math_lab/reference_verify.mjs implements an alternative exact decoder and R01 root parser without importing the production decoder or graph search transforms. It verifies root floor-canonicalization through integer power bounds, and performs separately coded inverse byte operations and zlib output-length checks.

The reference receipt contains SHA-256 of input, encoded stream and restored bytes, with exactByteEquality=true only on exact recovery. It also explicitly reports independentAgentReviewed=false, independentQACompleted=false and productionApproved=false. Code-independent validation is useful, but is **not organizationally independent audit**.

Manual separate-process reproduction can be run as:

    node tools/math-lab-reproduce.mjs ORIGINAL.bin CANDIDATE.mlg2 dataset.id

The script outputs hash receipts, never original bytes. It fails nonzero on corruption or mismatch.

## MAS security
- math_lab.read: browse catalog and propose a nonexecuting scientific research DAG.
- math_lab.experiment: run bounded CPU-only RootTransform experiments or math_lab.search.
- math_lab.verify: separately authorized math_lab.reproduce action (input-hex vs encoded-hex exact verification).

The graph-search action returns no encoded payload by default. The optional includeEncoded=true explicitly returns a reversible, therefore potentially sensitive, stream and requires math_lab.experiment permission. No data is automatically archived, uploaded, shared or submitted to AI providers.

The plugin remains a loopback-only independently approved MAS application. No new privilege, random code execution, task-pool write action, secret key, filesystem traversal or production service is added.

## Research workflow
Theory/literature -> dataset provenance and rights -> graph search -> exact reference reproduction -> counterexamples and representative corpus -> independent QA acceptance -> optional authorized Noosphere archival.

Existing Task Pool/Orchestrator owns task and execution state; Math Lab does not create parallel queues. Agent scientific roles remain *planned*, not running.

## Verification
    node --test tests/math_lab.test.mjs tests/math_lab_graph.test.mjs tests/math_lab_service.test.mjs
    node --check apps/math_lab/transform_graph.mjs
    node --check apps/math_lab/reference_verify.mjs
    node --check tools/math-lab-reproduce.mjs

## Follow-up
Implement independent QA identity/receipts, curated corpora including ALT/GENESIS trained model weight tensors, energy/time budgets, stronger codec baselines and archive format integration with independent review. Keep lossless and lossy research tracks separate.

This R02 draft does not prove state-of-the-art compression or universal average-case gains. No live services, agent queues, protected datasets or DARC archives have been modified.
