# Chromium Browser MAS 0.1.0

Built-in optional application: apps/browser/ (MAS 1.0).
It is independently startable with Core + Browser; it neither requires
Graph Studio nor alters the Toolbox microkernel.

## Chromium provider

The first supported Windows engine is installed Microsoft Edge (Chromium).
It is discovered from Windows App Paths registry keys defined in
apps/browser/engine.json. Other Chromium executables may be discovered from
PATH or configured explicitly with ADA_BROWSER_EXECUTABLE.
No browser binary is bundled, and the engine is optional.

A browser opens only when the user requests a tab, using its own randomly
named user-data directory below LOCALAPPDATA/Adamantium Toolbox/browser/sessions.
It does not inherit the regular Edge profile, saved passwords, or open tabs.
No persistent login sessions are promised in version 0.1.0.
The screenshot refresh interval and viewport are declared in engine.json.
Close session is best effort; status reports if the profile was removed.

## Rendering and automation

Chromium runs in headless mode. The Toolbox window displays snapshots of the
actual rendered page and maps clicks to Chromium viewport coordinates through
Chrome DevTools Protocol (CDP). This is NOT yet native smooth WebView2 embedding.

Typed MAS actions:
- browser.settings / browser.tabs: inspect UI settings and owned tabs
- browser.open / browser.navigate: open or visit HTTP(S) URLs
- browser.back / browser.forward / browser.reload: browser history controls
- browser.closeTab: close a tab belonging to the session
- browser.screenshot: receive a bounded JPEG viewport snapshot
- browser.click: click bounded viewport coordinates
- browser.type: type into the focused input, with a length limit
- browser.stop: close the session and attempt profile cleanup

All are invoked through /api/invoke and live CapabilityGraph, not by exposing
the raw debugging WebSocket as an external API. No arbitrary JavaScript
evaluation or credential export action is available.

Permissions are distinct: browser.read, browser.navigate, browser.interact.
An existing owner's policy is not automatically overwritten by installation.
Grant explicitly using:
    node tools/authorize-app.mjs inspect browser
    node tools/authorize-app.mjs grant browser --approve
Then restart Toolbox to refresh its permission environment.

## Security boundary

Remote debugging binds to a dynamically assigned localhost port. The port
is not exposed on the external network, but other processes with local
machine access may be able to access it. This is NOT OS sandboxing.
Do not browse untrusted pages with high-value sessions or assume the
browser cannot access internal network resources. Permissions gate the
Toolbox RPC only, not operating-system privileges of Chromium.
Each session uses an independent temporary user-data directory.

The engine process is isolated from normal Edge profiles, not necessarily
from local user files, system services, or LAN hosts. The next phases are a
native WebView2 renderer and optional isolated runner / network policy.
Keep all CDP endpoints local and disallow remote auto-activation.

## Acceptance tests

    node tests/isolation.test.mjs
    node tests/browser.test.mjs

The browser test hosts a local fixture website, then checks opening a
tab, screenshot capture, coordinate clicking, navigation and text input.
Windows with an installed Edge/Chromium engine runs a full integration test.
Without an engine the runtime test skips, while contract and isolation
tests remain available across platforms.

The running installed Toolbox is additionally checked via
node tests/browser_proxy.test.mjs. That test exercises navigation,
icons, and screenshot actions through the authorized core API.
