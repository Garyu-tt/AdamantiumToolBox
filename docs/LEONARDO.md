# Leonardo Graphics Router v0.1 (MAS 1.0)

Leonardo is a standalone graphics API router. It is NOT a mandatory kernel service.
Clients discover `leonardo.*` actions in the live capability graph; no direct imports.
Its sibling `leonardo_cpu` provides optional **procedural**, deterministic PNG icons,
not generative AI. Other image/video/render providers can be installed independently.

## App boundaries

- `apps/leonardo`: capability discovery, selection, dispatch and icon revisions.
- `apps/leonardo_cpu`: 64x64 CPU-only PNG procedural icon provider.
- Future plugins can provide image/video AI, 2D/3D render, effects, SVG, animation,
  theme / token adapters and transcoding. None are prerequisites.
- On failure or absence of a provider, the router returns
  `no_eligible_graphics_provider`; it never pretends an image/video was generated.
- Each service exposes MAS `/health`, `/graph`, `/invoke`, and local internal auth.
- Data remains in the owner-private profile; never commit generated user artifacts.

## Required owner capabilities

Opt-in permissions in the owner's private `policy.json`:
`graphics.read`, `graphics.generate`, `graphics.icons`, `graphics.provider`.
Existing owner policy is NOT overwritten. Restart/refresh the runtime after approval.
Image/video generator plugins must supply their own scoped permission manifests.
No public or external endpoint is configured; the routing core connects by
`ADA_CORE_URL`, supplied by the existing runtime. Local CPU works without GPU.

## Provider ABI: mas-graphics-provider-1

A provider contributes one resource node to its MAS graph:
```json
{
  "id":"any_provider.provider","type":"resource","requires":["graphics.provider"],
  "provider":{"schema":"mas-graphics-provider-1","locality":"local",
    "operations":[{"kind":"image","action":"any_provider.generate",
      "formats":["image/png"],"priority":20}]}
}
```
The referenced action must also exist in the **live authorized graph**.
Kinds: icon, image, video, render. Provider IDs and action IDs are discovered.
Local providers are preferred. Remote providers are opt-in per request.
Provider response: `{status:"completed",artifact:{mime,encoding,data}}` or
`{status:"queued",jobId,...}`. The latter is a contract extension point only;
v0.1 does not yet provide durable async job polling, storage or cancellation.

## Public actions (through standard Core /api/invoke)

- `leonardo.providers` returns eligible discovered provider operations.
- `leonardo.generate` params: `{kind,prompt,format?,providerId?,allowRemote?,options?}`.
- `leonardo.icons.regenerate`: above params plus `key` for an icon ID;
  stores completed PNG results atomically and increments their revision.
- `leonardo.icons.get`: params `{key}`; returns `found`, revision, sha256,
  providerId, updatedAt, and dataUri for preview.

Example:
```json
{"action":"leonardo.icons.regenerate","params":{"key":"editor",
 "prompt":"Minimal geometric editor pencil icon","format":"image/png"}}
```
v0.2 dynamically updates shell icons through an optional discovered asset provider.
This does not write into tracked source icon files. Assets are currently kept in a private JSON registry;
Database/Noosphere adapters and distributed replication are future plugins.

## Known limitations

Routing and preview are functional for small completed PNG icons. Provider result
schemas are validated only at the icon-store boundary, not for every media kind.
No AI image/video model is installed by these packages. No production job queue,
asset CDN, per-user billing, GPU scheduler, or distributed storage is included.
Avoid embedding credentials in requests or results.

## v0.2 dynamic shell icon adapter

Leonardo publishes a resource of schema `mas-graphics-asset-provider-1`.
The shell discovers `listAction` and `getAction` from the live capability
graph. No Leonardo-specific imports or plugin IDs are hardcoded in the shell.
The icon catalog contains only revision and SHA-256 metadata; changed icons
are fetched by key and reflected in the launcher and window title bars.
When the provider is absent, unhealthy or unauthorized, static app icons
remain usable. Core and optional apps do not require any new dependency.

## v0.3 asynchronous jobs for image/video providers

Provider operations can advertise an optional `jobs` descriptor:
```json
{"kind":"video","action":"provider.submit","formats":["video/mp4"],
 "jobs":{"statusAction":"provider.status","cancelAction":"provider.cancel"}}
```
The status/cancel actions must exist in the live authorized capability graph
and belong to the same plugin. `submit` can return `{status:"queued",jobId:"..."}`.
Leonardo stores only a private, bounded opaque job mapping, returning its own
UUID to clients. Other plugins use `leonardo.jobs.status`, `leonardo.jobs.cancel`,
and `leonardo.jobs.list` via the standard MAS API. If a provider disappears,
status reports `provider_unavailable` with the last observed status. No silent
cross-node failover is attempted. Long-running providers own their actual workers.
Cancelled/completed jobs are reported only after the provider confirms status.
v0.3 does not stream video bytes or install media generation backends.
Asynchronous icon regeneration is explicitly rejected pending an atomic
finalization protocol. This avoids reporting icons saved when they are not.
