# Desktop Workspace (MAS plugin)

An optional Windows-like desktop shell for Adamantium Toolbox. It replaces the
permanent left navigation column with a Start menu, desktop shortcuts, folders
and a taskbar. It is a UI surface, NOT a new central runtime or an app registry.

## Contract
- A MAS view may publish `surface: "workspace"` only if its independent
  manifest explicitly declares `ui.surface: "workspace"`.
- The shell discovers eligible, accessible views through `/api/graph`, not
  an application ID or fixed path. The current selection is deterministic
  (lexicographically first eligible provider).
- The provider receives only visible graph views and the LinkFS tree as UI
  data. Existing access checks in Core still gate `/api/invoke`.
- If the provider disappears, fails to mount or is disabled, the original
  LinkFS navigation returns. Standalone app launch remains supported.
- Core + Desktop requires no other optional MAS application.

## Behavior
- Start shows the folders and application references returned by LinkFS.
- Desktop shows top-level folders and app references plus user-pinned apps.
- Pinning uses browser-local storage and does not alter LinkFS or filesystem.
- Double-click-free icon activation is deliberate for touch accessibility.
- Folder Explorer opens a LinkFS folder in a movable/resizable window.
  Drag toward the top or sides to maximize or snap. Folder content is
  read-only, because LinkFS currently exposes references, not file mutations.
- Taskbar uses existing shell windows and includes the Start button, status
  and a local clock. Ctrl+Escape toggles Start; Escape dismisses it.
- All appearance derives from shared UI theme tokens.

## Development and verification
- `apps/desktop`: independent provider, UI, pure tree projection, Explorer.
- `shell/workspace.js`: generic provider bridge.
- `tests/desktop.test.mjs`: surface negotiation, unavailable-app filtering.
- `tests/isolation.test.mjs`: Core + bundled-app isolation including Desktop.
- `python tools/check-size.py`, `python tools/architecture-check.py`,
  `node tests/desktop.test.mjs`, `node tests/isolation.test.mjs`.

The first version does not yet offer drag-and-drop icon rearrangement, folder
creation/rename, multiple workspaces or workspace-provider selection in Settings.
Those should be added through separate typed capabilities, not ad hoc file I/O.
