# Mechanicus Universal Graph — Rete.js v2 adapter (G2a)

**Source-only browser prototype, not a released MAS plugin.**

- Uses actual MIT-licensed `rete`, `rete-area-plugin`, `rete-react-plugin`,
  `rete-connection-plugin` and `rete-render-utils` packages, plus React and Ajv.
- Does **not** import `rete-structures` or `rete-scopes-plugin` (noncommercial
  CC-BY-NC-SA-4.0). A final SBOM must validate every transitive license.
- Loads JSON against the **G0 canonical** schema, not Rete's internal
  serialized editor state; editor canvas is a disposable projection.
- Renders typed sockets by datatype plus semantic role; graph refs stay
  symbolic. No \`rete-engine\`, Node runtime dependency for native G0,
  plugin invocation, hardware access, script evaluation or GPU driver.
- Dragged connections create **draft proposals only**. The visual graph
  rejects local node/edge persistence; a future Graph Manager must perform
  authorization, structural compilation and CAS, then return a fresh verified
  graph. All proposals are marked `authorized:false, executable:false`.
- Interactive Rete.js viewport is not a headless engine. Closing it never
  stops the actual runtime and never alters Noosphere state.

## Local preview

`cd apps/universal_graph_rete`
`npm install`
`npm run check && npm run build`
`npm run dev`

Sample `samples/genesis.json` is a static, fake GENESIS tensor-handles
graph with no private weights or execution. No live server is contacted.

This preview is **not accepted for release** until a pinned lockfile,
dependency license/SBOM audit, cross-browser rendering, read/write proposal
round-trip, large-graph virtualization and independent security review land.

It remains a separately installable MAS UI component. The native graph IR
continues to compile with pure C++17 when this whole directory is absent.

## Local Universal Graph JSON preview (G2b)

Use the **Local G0 JSON** file chooser in the toolbar. Import the JSON output of
`apps/universal_graph_genesis/convert.mjs` from the independent G3 bridge
(PR #144), or any document in the **canonical G0** Universal Graph IR schema.
Files are read entirely inside the browser; no upload, remote graph write or
capability invocation occurs. A strict schema check precedes rendering,
and a maximum 8 MiB file size is enforced before and after reading.
Malformed files are rejected without destroying the currently displayed graph.
Large graph virtualization and structural C++ compiler validation remain
separate release gates: schema validity alone is not runtime authorization.
