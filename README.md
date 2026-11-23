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

## Headless
Backend-only MAS plugins are supported without UI assets; see [headless rails](docs/HEADLESS-RAILS.md).

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

## Declarative asset policy
Static shell UI and app asset routes are declared in
standards/architecture/assets.json; core/assets.mjs validates mounts and extensions
and refuses asset traversal. Tests: node tests/assets.test.mjs.

## Discovered system services
Base services are registered by independent JSON manifests in services/*.json.
Core lifecycle discovers modules at runtime and stops removed/disabled services.
Mesh API and Mesh worker run as optional system services, not hardcoded children.
Run node tests/services.test.mjs.

## Signed plugin lifecycle
Use node tools/lifecycle.mjs status or plan <hash> to inspect a Mesh package.
Select signed versions with activate <plan.json> --approve; rollback <id> --approve.
The registry is atomic and preserves previous hashes; the supervisor picks up changes.
Executable third-party plugins run with current OS-user privileges. No sandbox yet.
See docs/LIFECYCLE.md. Never activate received packages automatically.

## Runtime Recovery
The supervisor monitors each app's health and API graph, rate-limits retries,
quarantines repeated crashes, and automatically rolls back signed external
plugins to the last selected version when enabled by the runtime policy.
Read docs/RUNTIME-RECOVERY.md and inspect node tools/lifecycle.mjs status.
Runtime recovery is NOT a sandbox or protection against malicious code.

## Chromium Browser MAS
apps/browser provides an optional Chromium-powered browser view with isolated
Edge/Chromium profile, typed CDP automation actions, screenshot preview, tabs,
navigation, clicking and text input. Core + Browser works without other addons.
See docs/BROWSER.md. It uses a screenshot viewport, not native WebView2 yet.
Owner permissions must be explicitly granted with
node tools/authorize-app.mjs grant browser --approve, followed by a restart.

Installed-browser smoke test: node tests/browser_proxy.test.mjs.
This uses a temporary local fixture site and does not access private accounts.

## Browser Continuity and cross-node control
Browser MAS retains one owner-private Chromium profile across restarts.
Other nodes can control that browser through a client-side loopback SSH
forward and a separately scoped relay key; no raw cookies or native profile
are copied across operating systems. Site-specific device-bound logins may
still require reauthentication. See docs/BROWSER-CONTINUITY.md.

## Adaptive window manager
All MAS apps and system tools share viewport-correct title-bar dragging,
maximize/restore/minimize, edge and corner snap, live snap preview and
configurable layouts for up to eight windows. Use the "Окна" toolbar menu
for grid, asymmetric primary-pane layouts and split-size adjustment.
See docs/WINDOW-MANAGEMENT.md. Test with node tests/window_ui.test.mjs.


## Adamantez source boundary

Public code lives here; private implementation in separately controlled repositories.
Neither holds production secrets. Optional providers require MAS authorization.
See [source boundary](docs/ADAMANTEZ-SOURCE-BOUNDARY-R01.md) and
`standards/repository-sources/registry.example.json` (metadata only).
