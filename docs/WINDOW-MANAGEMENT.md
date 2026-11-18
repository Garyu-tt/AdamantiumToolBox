# Window Management v1: viewport-correct drag and adaptive tiling

Source: shell/window_manager.js, window_pointer.js, window_geometry.js,
window_preview.js, window_layout_ui.js and declarative window-layouts.js.
Both regular MAS applications and system tools use the same manager.

## Dragging without pointer offset

The previous implementation mixed viewport-space clientX/clientY with
desktop-relative CSS left/top. A sidebar or header therefore introduced
an unwanted offset when dragging regular application windows.
Now movement uses initial desktop-relative window coordinates plus
only the pointer delta. Dragging behaves consistently regardless of
the absolute desktop offset and browser page zoom.

Pointer capture is released on pointerup or pointercancel, with
lostpointercapture cleanup. The drag threshold prevents accidental
movement on clicks. Buttons and form fields do not initiate a drag.

## Window controls

- Double click a title bar to maximize or restore inside the Toolbox
  desktop, not across the entire physical Windows monitor.
- Use the maximize/restore button in every title bar.
- Minimize a window and reopen it via the bottom task bar.
- Drag to the left or right boundary for half-screen placement.
- Drag into the four desktop corners for quarter-screen placement.
- Drag to the top edge to maximize. A translucent preview shows
  the intended snap region before the mouse button is released.
- Drag a tiled/maximized window away by its title bar to detach it.
- Ctrl+Alt+Left/Right snap the active window to either side;
  Ctrl+Alt+Up maximizes, Ctrl+Alt+Down restores.

## Snap layout chooser

The dynamically inserted "Окна" toolbar menu can arrange up to
eight open windows. Schemes are declared in shell/window-layouts.js:
grid, columns, rows, primary left, primary right and primary top.
An adjustable split slider distributes different amounts of space
to the primary pane. The layout can be reset to free-form positions.

The layout adapts on desktop resize without full page reload.
Grid gaps, maximum window count, pointer threshold, split bounds and
layout options live in one data-driven configuration module.
The manager does not enumerate or hardcode application IDs.

Tiled windows disable freeform CSS resizing to prevent overlap.
Users can leave a tile by dragging, and adjust a mosaic's sizes using
the split slider. Dragging one tile does not resize the other windows
individually. Persisting layouts between browser reloads and
interactive split-pane resizers are future extensions.

## Acceptance

    node tests/window_geometry.test.mjs
    node tests/window_ui.test.mjs
    node tests/window_shell.test.mjs (installed Toolbox only)

The geometry test verifies nonzero desktop offsets, drag deltas,
edge/corner snapping, six layout patterns, non-overlap for 1-8 windows,
ratio changes and bounds after resizing.

The actual Chromium test uses Chrome DevTools Protocol mouse input
against a local fixture with a desktop offset from the viewport.
It asserts exact window movement, maximize/restore, live snap preview,
drop-to-maximize, eight-way grid, asymmetric mosaic and restore.
The Windows CI runner executes both tests. Linux CI skips the graphical
test when a Chromium sandbox is not provisioned.

No new environment-specific URLs, hardcoded app navigation or colors
were added to the implementation. Theme variables come from MAS UI.
