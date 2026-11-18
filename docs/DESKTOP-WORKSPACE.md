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
- A unified window manager controls application, system and folder windows.
  The taskbar switches focus or minimizes a focused window.
- Folder Explorer opens LinkFS folders in movable/resizable windows. Its content
  remains read-only because LinkFS provides references, not filesystem writes.
- Titlebar drag to the upper edge maximizes; left/right edges snap to halves;
  four corners snap to quadrants. A click alone never detaches the window.
- Minimize, maximize/restore, close, double-click titlebar and drag-to-restore
  share one implementation. Snapped layouts reflow when the workspace resizes.
- The layout chooser arranges the first 2, 4, or 8 visible windows in grids.
  The asymmetric preset places one primary window beside two smaller windows.
- Keyboard: Ctrl+Escape opens Start; Escape dismisses menus.
  Ctrl+Alt+2/3/4/8 selects grid/preset. Meta+Arrows snaps/maximizes/restores
  when the host browser forwards those combinations. Ctrl+Alt+Arrows is an
  alternative when the operating system intercepts the Meta shortcuts.
- Taskbar includes the Start button, layout chooser, open windows and clock.
- All appearance derives from shared UI theme tokens.

## Development and verification
- `apps/desktop`: independent provider, UI, pure tree projection, Explorer.
- `shell/workspace.js`: generic provider bridge.
- `tests/desktop.test.mjs`: surface negotiation, unavailable-app filtering.
- `tests/window_geometry.test.mjs`: tiling coverage and snap geometry.
- `tests/isolation.test.mjs`: Core + bundled-app isolation including Desktop.
- `python tools/check-size.py`, `python tools/architecture-check.py`,
  `node tests/desktop.test.mjs`, `node tests/isolation.test.mjs`.

The first version does not yet offer drag-and-drop icon rearrangement, folder
creation/rename, multiple workspaces, shared-border resizing, or workspace-provider selection in Settings.
Those should be added through separate typed capabilities, not ad hoc file I/O.
