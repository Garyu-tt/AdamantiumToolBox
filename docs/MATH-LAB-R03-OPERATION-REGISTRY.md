# Math Lab R03 — Operation IDs and paired Encode / Decode DAGs

Status: stacked **draft PR #167**, based on R02 #165 and R01 #163. Not deployed, not merged. These IDs describe data formats, never MAS execution rights.

## Canonical ID allocation

All IDs are unsigned 16-bit integers, encoded big-endian.

| Encode ID | Exact forward mapping | Decode ID | Legacy MLG2 |
|---|---|---|---|
| 0x0101 | XOR current byte with previous byte | 0x8101 | transform 1 |
| 0x0102 | Subtract previous byte mod 256 | 0x8102 | transform 2 |
| 0x0103 | Even byte indexes then odd byte indexes | 0x8103 | transform 3 |
| 0x0104 | 8x8 bitplane transpose, unchanged 1–7-byte tail | 0x8104 | transform 4 |
| 0x0105 | Reverse byte order | 0x8105 | transform 5 |
| 0x0201 | Complete zlib-wrapped stream | 0x8201 | codec 1 |
| 0x0202 | Complete RootTransform MLR1 frame | 0x8202 | codec 2 |

Each declaration includes kind, direction, version 1, exact input/output types, inverseId and an immutable registry digest.

Reserved ID ranges: forward transforms 0x0100–0x01FF; terminal encoders 0x0200–0x02FF; inverse transforms 0x8100–0x81FF; terminal decoders 0x8200–0x82FF. Unknown IDs reject, not guess. Once an ID is published, never change its mathematical meaning. New parameters, changed numeric semantics or input types require new IDs or a new compatible version. The stable ID is **not** the name of a Node-RED node, a function pointer, or a permission.

## Encode and Decode graph synthesis

A plan has the exact schema mechanicus.math-operation-plan/1 and fields operationIds and codecId. R03 supports 0–3 transforms followed by exactly one terminal codec. For example:

    forward: bytes -> 0x0101 -> 0x0103 -> 0x0201 -> frame
    reverse: frame -> 0x8201 -> 0x8103 -> 0x8101 -> bytes

The independent graph projections include typed ports and edges and can be rendered by Adamantium-node IDE and Android AI Core. The registry ensures exact inverse pairs; the decoder *runs inverse IDs in reverse order*. This is initially a single-input/single-output DAG, not a branching graph; split/join transformations will need an explicitly versioned invertible schema with independent reconstruction witnesses.

## Wire format MLG3

    4 bytes   ASCII MLG3
    1 byte    registry major = 1
    8 bytes   registry SHA256 fingerprint prefix
    varint    original source byte count
    1 byte    number of transforms, 0–3
    2*N bytes forward operation IDs, uint16 big-endian
    2 bytes   terminal codec ID
    varint    compressed payload byte count
    16 bytes  truncated SHA256 of original bytes
    bytes     complete zlib or RootTransform MLR1 leaf

The checksum and registry hash are error-detection and compatibility controls, **not cryptographic authentication**. Trusted releases need independently pinned signers and authorized MAS capabilities. All frame bytes and metadata count toward size comparisons. MLG3 is intentionally larger than MLG2; previous R02 benchmark scores cannot be reused without recalculating their new wire cost.

The library bounds source blocks to 8192 bytes, frames to 8448 bytes and transform depth to 3. The MAS API further caps experiments to 2048 input bytes. Unknown IDs, impossible type joins, invalid versions, noncanonical lengths, truncation and checksum mismatch fail closed.

## Legacy compatibility

The R02 MLG2 single-byte IDs are recognized only by an explicit migrator. It validates the old frame with the existing independent R02 decoder, maps opcodes and leaf codec to stable R03 IDs, produces a new self-contained MLG3 frame and validates the same original bytes again. It does not silently reinterpret a v2 opcode inside a v3 frame, and migration may increase size.

## MAS actions

- math_lab.operations (math_lab.read): catalog of stable IDs, types, inverse IDs and registry digest.
- math_lab.graph (math_lab.read): typed Encode and Decode graph construction without running any operations.
- math_lab.encode (math_lab.experiment): CPU-bounded MLG3 encoder. No reversible output bytes are exported unless includeEncoded=true.
- math_lab.decode (math_lab.verify): decoder and checksum check. No original data is exported unless includeDecoded=true.
- math_lab.migrate (math_lab.verify): exact MLG2 to MLG3 compatibility path, explicit export only.

The registry is fixed code. No dynamic executable plugins, arbitrary script loaders, direct archive modification or implicit task dispatch.

## Scientific verification and future work

Tests cover forward/inverse kernels on lengths including 0, 1, 7, 8 and odd sizes; graph type joins; exact ID pairs; MLG3 roundtrip with zlib and RootTransform; actual legacy codec migration; malformed frames; permissions; user-data export controls.

R03 does not prove improved compression. A separate independent mathematical QA group, hostile fuzzing, real corpus benchmarks (including ALT/GENESIS tensors), model distribution accounting and CPU/energy scoring are still required.

Future branching dataflow graphs must version and serialize split/merge operators, branch topology, deterministic inversion witness and exact metadata. Neither Graph Manager nor Node-RED graph links should create MAS permissions.

Production services, research agents, Noosphere stores, Android APKs and existing archives are unchanged.
