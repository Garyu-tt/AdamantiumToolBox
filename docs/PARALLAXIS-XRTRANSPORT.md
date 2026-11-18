# ParallaXis XR Transport MAS 0.2.0

Read-only, independent PCVR transportation adapter for AdamantiumToolBox.
No HTC VIVE Hub dependency; no root or Android firmware modification.

## Architecture

The MAS app lives at apps/xrtransport and obeys standards/MAS-1.md.
It exposes the backend graph only when the app is running and authorized.
Packaged adapter modules are discovered in apps/xrtransport/adapters.
Provider instances are configured privately by XR_PROVIDERS_FILE.
They do not auto-install, auto-start, auto-pair, or auto-trust clients.

ALVR adapter: an operator-configured loopback endpoint only, GET
/api/version with X-ALVR header. State server_observed is NOT proof of
streaming or successful pairing. WiVRn adapter: Linux /proc process
observation only, which also does NOT prove a streaming connection.

Optional ADB device inventory enumerates system and user package names
plus selected getprop properties for an explicitly selected, authorized
device. It is NOT a complete APK/data/firmware backup.

## Security

- Read-only invocation surfaces for this release.
- ADB execFile with fixed argument vector, never shell injection.
- Per-action permission scopes: xrtransport.read and xrtransport.inventory.
- ALVR probes restricted to literal loopback addresses; no remote HTTP probes.
- No compiled-in service IPs, device serials or local file paths.
- No changes to stock HTC packages or firmware.
- No VIVE Hub/Streaming dependency.

## Local installation and tests

Drop apps/xrtransport into Toolbox. Configure XR_PROVIDERS_FILE to a
private JSON array of provider instances with id, adapter, label and
an ALVR endpoint (when applicable). Requires Node.js 20+ and
optional local ADB executable. The standalone test package includes
tests/xrtransport.test.mjs for localhost ALVR and ADB mock checks.

## Next gates

1. Verified hosted MAS handshake and authenticated remote capability routing.
2. ALVR streaming and pairing evidence from actual driver events.
3. User-approved ADB snapshot/export, with APK visibility limitations recorded.
4. Native XR OpenXR host independent of PCVR providers.
5. No changes to system packages until device-specific restore gate passes.
