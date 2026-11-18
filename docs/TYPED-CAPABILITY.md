# C03 — Typed capability invocation (opt-in, MAS 1.0 compatible)

Generated MAS apps package a standalone typed validator with their service.
`sdk/schema.mjs` validates a **strict, documented subset** of JSON Schema.
`sdk/invoke.mjs` checks the active graph, validates input **before** calling
the handler, then validates output **before** sending it to Core.
Core's existing `/graph` and `/invoke` compatibility ABI is unchanged.

## Supported schema subset

Required `type`: `object`, `array`, `string`, `integer`, `number`,
`boolean`, or `null`. Common: scalar `enum`. Objects: `properties`,
`required` (must name declared properties), `additionalProperties` (boolean).
Arrays: `items`, `minItems`, `maxItems`. Strings: `minLength`, `maxLength`.
Numbers: `minimum`, `maximum`. Integer means a JavaScript safe integer.
Types are not coerced. Schema recursion is bounded (16 levels, 256 nodes);
value traversal is bounded (24 levels, 10,000 nodes). Unknown keywords,
`$ref`, `oneOf`, `allOf`, `pattern`, custom callbacks and union types fail
closed with `schema_unsupported` or `schema_invalid`. They are **not**
silently ignored. This is not a full JSON Schema engine.

## Wire behavior for generated apps

| Condition | HTTP | Error |
| --- | --- | --- |
| Action missing / disabled | 403 | `capability_unavailable` |
| Input does not conform | 422 | `input_invalid` |
| Handler failure | 500 | `handler_failed` |
| Output does not conform | 502 | `output_invalid` |
| Malformed request | 400 | `invalid_request` |
| Invalid module/schema graph | 503 on `/graph` | `bad_graph` |

The active state is loaded from one version of `modules.json` per request;
no action may execute if its declared capability is absent from that graph.
A typed result gate cannot roll back side effects already performed by a
handler; transactional or idempotent mutations must be handled separately.

## Isolation and compatibility

Generated apps carry `runtime/modules.mjs`, `runtime/graph.mjs`,
`runtime/schema.mjs` and `runtime/invoke.mjs`; they do not import the
developer SDK from Core. MAS 1.0 existing apps are unchanged. This is
opt-in for newly generated plugins, not an implicit migration.

Tests: `tests/sdk_schema.test.mjs`, `tests/sdk_scaffold.test.mjs`,
`tests/sdk_modules.test.mjs`, all existing Core + App isolation tests.
The standalone SDK GitHub workflow runs on Linux and Windows.

Remaining work: versioned schema discovery across peers, service-level
authorization independent of Core's local key, output size budgets,
semantic response error telemetry, and fully transactional state changes.
