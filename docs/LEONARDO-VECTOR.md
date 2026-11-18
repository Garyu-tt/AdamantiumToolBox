# Leonardo Vector CPU v0.1

Independent MAS 1.0 plugin `apps/leonardo_vector`; optional provider for Leonardo.
The microkernel does not import it, and Leonardo discovers it from the live graph.

**Capabilities:** `graphics.provider` (explicit owner policy), procedural SVG images
(`kind=image`) and typed scene rendering (`kind=render`).
Formats: `image/svg+xml`. Both operate entirely on CPU and need no model or GPU.
This is **not** prompt-to-image AI: a prompt seeds deterministic abstract artwork,
or `options.scene` contains explicitly supplied shapes.

Example via core:
```json
{"action":"leonardo.generate","params":{"kind":"render",
 "format":"image/svg+xml","prompt":"system diagram",
 "options":{"width":640,"height":360,"scene":[
  {"type":"rect","x":16,"y":24,"width":180,"height":80,"fill":"#4055aa"},
  {"type":"text","x":30,"y":70,"text":"Core","fill":"#ffffff"}
 ]}}}
```

Supported shapes: `rect`, `circle`, `ellipse`, `line`, `text`.
Every coordinate, dimension, color and opacity is validated. Markup is generated
from a fixed element whitelist; text is XML-escaped. External URLs, user-supplied
SVG markup, scripts, CSS, font loading and arbitrary path data are not supported.
SVG output is capped at 110 kB and the input scene at 96 elements.

A renderer may be installed or removed without affecting the Core or the
existing CPU PNG icon provider. Vector results are returned as a small base64
artifact, not written to the icon registry; the current registry only stores PNG.
