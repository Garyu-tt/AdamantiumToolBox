# Adamantium Genome GA1a — canonical transport envelope

**Status:** source-only experimental contract. Parent: native typed genome
GA0 #149 and Universal Graph IR G0 #143. Roadmap: #147.

## Wire contract: AGM1

A network-byte-order, deterministic, length-prefixed, **unsigned** binary
envelope. It describes already-validated genotype records and **never**
executes them, grants authority, or contains host secrets.

| Field | Encoding |
| --- | --- |
| Magic | ASCII `AGM1` (4 bytes) |
| Wire version | unsigned big-endian 16-bit, value 1 |
| Genome version | unsigned big-endian 16-bit, value 1 |
| Provenance lane | unsigned 8-bit: baseline=0, acquired=1, experimental=2 |
| Reserved | unsigned 8-bit, zero (must reject nonzero) |
| genomeId / rootGraph | unsigned big-endian 16-bit byte length, printable ASCII |
| chromosome count | unsigned big-endian 32-bit, 1..2048 |
| chromosome | graph ID string, gene count u32, typed genes |
| gene | kind u8, ordinal u32, kind-specific exact fields |

Gene kinds: Header=0 (domain u8, schema version u32, graph revision u64),
InterfacePort=1 and NodePort=3 (owner string; port ID/type strings;
direction u8, edge semantics u8), Node=2 (ID, kind u8, typeRef, graphRef,
graphRef revision u64), Edge=4 (ID, two node/port endpoints, semantic u8,
delay ticks u32). Unsigned u64 must remain exact in JavaScript **BigInt**.

Strings are byte-bounded printable ASCII (max 256 bytes); empty strings are
permitted only where the typed IR allows them. Chromosomes must be ordered
lexicographically by graph ID; genes retain GA0 exact ordering and ordinals.
No implicit unicode normalization, object key insertion order, host-native
endianness, pointer representation, floating-point coercion or implicit casts.

Decoder limits: 16 MiB whole frame, 2048 chromosomes, 1,000,000 total genes.
Malformed/truncated/trailing/noncanonical data is rejected before publishing
output. C++ decoder reconstructs the complete GA0 genotype and validates all
graphs through the headless Universal Graph IR before success. A Node adapter
uses independently written framing code; its decoded result is **not**
independent authority to execute/activate a phenotype.

## Acceptance

Native:
`cmake -S native/genome -B build-genome -DCMAKE_BUILD_TYPE=Release`
`cmake --build build-genome --config Release`
`ctest --test-dir build-genome -C Release --output-on-failure`

To test Node-free native compilation:
`cmake -S native/genome -B build-genome-no-node -DMAS_GENOME_NODE_INTEROP=OFF`

The optional Node fixture executes the C++ CLI in **emit/read** modes and
verifies that JavaScript decodes *and re-encodes byte-identical* MAS composite,
Dante delayed feedback and infrastructure permission genes. It also checks a
JS-produced acquired-lane envelope round-trips through the C++ verifier.
Hashing test bytes with SHA-256 is a reproducibility measurement, **not**
authentication or signature verification.

## Boundaries and next gate GA1b

No private keys, content-addressed artifact registry, pinned executable blob,
signed trust root, mutation promotion, compression, live capability binding or
server restoration exists here. For signed distribution add an external
signed manifest referencing exact envelope digest, artifact digests and
revocation policy. The trusted bootstrap must validate this before generating
an inert GA2 expression plan; an editor or legacy Node script must not
mint authorization.

The Windows JediControl host is only an independently authorized, isolated
test target. A successful test on that host is not evidence of deployment to
a production server. Keep existing device tokens/agent untouched.
