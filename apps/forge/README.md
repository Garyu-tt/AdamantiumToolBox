# Forge adapter R01

Pure MAS contract adapter. No database, in-memory task queue, graph engine, provider
execution, memory, agent, retry worker or automated repair. `view.js` is an inspector.

`forge.describe` returns machine-readable proposed ports, relations and rules.
`forge.validate` validates `params.function` (`forge.function.v1`).
`forge.prepare` validates `params.function`, `request_id`, and `arguments`, then
returns an **unexecuted** `forge.invoke.request.v1` envelope for host routing.

Contract shape: `schema`, `id`, `version`, `request.atomic`, `request.goal`,
`request.acceptance[]`, `capability.action`, `capability.input_schema`,
`capability.output_schema`, optional `dependencies[]` and `ui` contribution.

Smoke: start with a host-generated `ADA_INTERNAL_KEY` (at least 24 characters),
`ADA_CAPS=forge.read,forge.validate` and `APP_PORT` on a free local port.
`GET /health` is public, `/graph` and `/invoke` require the internal key.
Host auth and capability permissions remain mandatory for actual UI invocation.

See `docs/FORGE-ADAPTER.md`, `docs/FORGE-ROADMAP.md` and
`docs/FORGE-INCIDENTS.md` for boundaries, composition and future functionality.
