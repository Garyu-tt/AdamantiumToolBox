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
v0.1 does not change the shell's existing icon files. Connecting stored
revisions to live shell icons is a **follow-up adapter**, not an implicit
write to source files. Assets are currently kept in a private JSON registry;
Database/Noosphere adapters and distributed replication are future plugins.

## Known limitations

Routing and preview are functional for small completed PNG icons. Provider result
schemas are validated only at the icon-store boundary, not for every media kind.
No AI image/video model is installed by these packages. No production job queue,
asset CDN, per-user billing, GPU scheduler, or distributed storage is included.
Avoid embedding credentials in requests or results.
