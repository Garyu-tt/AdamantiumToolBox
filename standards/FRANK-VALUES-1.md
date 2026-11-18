# FRANK-VALUES-1 — lossless values across Frankenstein adapters

Frank Addon actions use the existing JSON transport. The bridge validates
all parameters and returned results before forwarding. Ordinary JSON
`null`, booleans, finite numbers, strings, arrays and string-keyed objects
are portable across Python, JavaScript and Rust.

JSON alone cannot guarantee the identity of 64-bit integers or raw bytes
across languages, so FRANK-VALUES-1 reserves **explicit tagged objects**:

```json
{"$frank":"i64","value":"9223372036854775807"}
{"$frank":"u64","value":"18446744073709551615"}
{"$frank":"bytes","value":"AQIDBA=="}
```

Tags are JSON objects with exactly two keys: `$frank` and `value`.
Integers are canonical decimal strings in signed or unsigned 64-bit range.
Bytes are canonical base64. These tags can be nested in ordinary arrays and
maps. Adapters may decode tags into native integers/bytes, but must encode
them as tags again before returning results. A tag does **not** grant
filesystem, network, or hardware capabilities.

Limits: maximum nested depth 16, 2048 visited nodes, 256 entries per
array/map, 32 KiB serialized value, canonical base64 and safe ordinary
JSON integers only. Unsafe Javascript numeric integers are rejected: use
an `i64` or `u64` tagged object rather than silently rounding. Object keys
`__proto__`, `constructor` and `prototype` are rejected.

## Cross-language capability composition

`frankenstein.pipe` appears only when at least two live, approved Frank
actions are discoverable. The invocation parameters are:

```json
{
  "from":"frankenstein.python.hello.echo",
  "to":"frankenstein.javascript.hello.echo",
  "input":{"text":"Привет","exact":{"$frank":"i64","value":"9223372036854775807"}}
}
```

The bridge calls `from` with `input`, validates its output, and then calls
`to` with `{"input": <source-result>}`. The result of `to` is returned.
The destination capability and approval are refreshed after the source
finishes. Both target actions must exist in the current live graph; arbitrary
commands, paths and raw execution are not accepted. This is a single-hop
composition, not recursive orchestration, retries or distributed transactions.

Typed wire tags preserve representation; native decoding beyond the wire is
adapter-specific. Rust example packages may forward JSON opaquely but are
not general-purpose JSON codecs. Cross-language pipeline authorization still
inherits the bridge-wide `frankenstein.invoke` scope; per-action delegation,
durable workflow logging and crash-consistent side-effect semantics are
future work.
