# Adamantium Toolbox
AI-native, modular Mechanicus runtime. Desktop is an optional human shell; NeuroCMS is the future web shell.
Experimental local prototype, not a production-ready cluster.

## Stable core
- core/kernel.mjs: small HTTP capability graph and action router
- core/catalog.mjs, core/contract.mjs: discover independent MAS applications by manifest
- core/linkfs.mjs: filesystem-driven interface tree containing safe application references
- core/codemap.mjs and tools/codemap*.py: L0/L1/L2 source maps
- core/frontend.mjs: frontend graph and backend bindings
- standards/layout: PuzzleGrid geometry engine
- standards/mesh: experimental signed package transport primitives (not full auto-sync)
- standards/ui: plain Windows-like UI Kit; optional themes later

## Applications
Apps/editor and apps/studio are optional examples, not mandatory runtime modules.
Shell shows only real, accessible capabilities. No placeholder modules.

## Local Windows install
C:\Program Files\Adamantium Toolbox
Private data: %LOCALAPPDATA%\Adamantium Toolbox
Task Scheduler: AdamantiumToolboxServer (started on demand)
Desktop: one Adamantium Toolbox shortcut. App shortcuts in Start.
HTTP service: 127.0.0.1:8880, local bearer token.

## Public repository rules
No credentials, user state, SSH keys, auth.json, node identities, cache, peer secrets,
client configs, private memories, VM backups or absolute access paths in the repo.
Public source does not grant an OSI open-source license: no license chosen yet.
Live multi-node Continuity Mesh is not configured.
Run python tools/check-size.py and node tests/*.test.mjs and node tools/mas-check.mjs.

## AI-native Semantic IR
Agent API: GET /api/semantic, /api/object, /api/changes/history and
POST /api/changes/plan, /api/changes/apply, /api/changes/rollback.
See docs/SEMANTIC-IR.md. Direct headless client: node tools/agent.mjs semantic.
This first implementation only modifies typed UI nodes, not arbitrary source code.

## Mesh plugin distribution
Drop a MAS plugin directory into %LOCALAPPDATA%\Adamantium Toolbox\plugins\inbox.
The built-in worker creates signed, content-addressed bundles and retries trusted peers.
Only trusted packages are STORED; code is not auto-activated in this release.
Configure peers and read deployment caveats in docs/MESH-SYNC.md.

## Architecture Rule 1
No architectural hardcoding. All changeable endpoints, links, rights, visuals and
infrastructure values come from data or discovery. See docs/ADR-0001-ARCHITECTURE.md.
The default owner permission policy is copied to local policy.json on first launch;
existing policy files are never overwritten. Run python tools/architecture-check.py,
python tests/architecture.test.py and node tests/isolation.test.mjs before acceptance.

## Optional DedupArc provider
node tools/archive.mjs pack snapshot.darc ./apps
See docs/DEDUPARC-STORAGE.md. .darc random-access writes are not implemented.
