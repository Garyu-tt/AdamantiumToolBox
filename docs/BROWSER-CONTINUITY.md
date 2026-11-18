# Browser Continuity v1: keep identity on the browser host

Chromium profile and authentication are owned by the *browser-host node*.
A client node controls the browser via the MAS Browser provider. Switching
the client or restarting Chromium does not copy or delete the browser profile.

## Persistent login

The host creates browser/identity.json once under its own Toolbox runtime.
It uses a stable UUID pointing to browser/profiles/<identity UUID>.
Cookies, local storage, IndexedDB and other Chromium profile files belong to
this directory. browser.stop closes Chromium gracefully and retains them.
Each running profile has an exclusive .mas-active lease. A dead process lease
may be recovered; a still-live owner prevents concurrent use.

Existing native Edge or Chrome profiles are NEVER automatically imported.
If the user signed in only in their regular Edge profile, they must sign in
once to the Toolbox Browser profile. Sites can expire cookies, revoke tokens,
require MFA, bind passkeys or log out after an IP/device/security change.
No software can promise an eternal login on every site.

## Cross-node model: execution stays where the identity lives

Host browser on server, client Toolbox on laptop: log in through the client's
browser view; cookies and execution remain on server. Laptop may disconnect
and the server profile persists. Reattach through the tunnel later.

Host browser on laptop, client Toolbox on server: reuse the laptop browser's
Toolbox login, but laptop must remain reachable and powered on.

No raw cookies, browser profile, passwords, or private keys are copied across
nodes. This avoids incompatibilities with OS-specific encryption, Chromium
App-Bound Encryption and device-attested sessions. Do not disable Chromium
cookie encryption to make a profile portable.

## Connect via an authenticated local tunnel

On the **host**, with the Toolbox already installed:
    node apps/browser/cli.mjs host-enable --approve

This creates a secret file in the *host user's* private runtime directory:
    <runtime>/browser/relay-host-key

Do not paste it into chats, logs or a repository. Copy it only via a
user-authorized protected channel (for example, authenticated SSH/SCP)
to a temporary, non-shared file on the client machine.

On the **client**:
    node apps/browser/cli.mjs client-import <protected-key-file> --approve

Create a private SSH port forward from client to the host's loopback
Browser MAS port (the port comes from apps/browser/manifest.json).
For example, if host browser service uses 8892 and client chooses 9899:

    ssh -N -L 9899:127.0.0.1:8892 <host-ssh-user>@<host-tunnel-address>

On the **client**:
    node apps/browser/cli.mjs use-relay 9899 --approve

Restart the Toolbox supervisor on both nodes after enabling relay access
or changing provider mode; keep SSH forwarding alive while using the remote
browser. On Windows, restart the AdamantiumToolboxServer scheduled task
through normal administrative controls. No public CDP port is needed.

Inspect without exposing tokens:
    node apps/browser/cli.mjs status

To use the local Chromium engine instead:
    node apps/browser/cli.mjs use-local --approve

Key rotation/revocation and unattended tunnel reconnect orchestration are
future work. Do not configure relay on an untrusted shared machine.

## Security and consistency

- The remote provider accepts ONLY loopback tunnel URLs. It does not accept
  arbitrary HTTP endpoints, LAN URLs or credential-bearing URLs.
- Host service continues to bind to loopback. A separate 256-bit relay key
  authenticates scoped Browser MAS requests; the core's internal key is
  never transmitted across nodes.
- Relay key grants browser operations. Treat it as a secret with access to
  the logged-in browser. Limit filesystem ACLs and SSH access appropriately.
- Runtime browser actions remain gated by browser.read, browser.navigate and
  browser.interact on both sides. These are API permissions, not OS isolation.
- Only ONE Chromium process may own a browser identity at once; do not
  synchronize or mount the same live profile from multiple machines.
- Profile storage is private user data, excluded from public repository,
  ordinary Mesh plugin bundles, source snapshots and shared logs.
- The relay session has no automatic credential export. Portable, opt-in,
  end-to-end encrypted state migration remains a separate unimplemented feature.
  Even that cannot guarantee site-issued device-bound credentials will work.

## Tests

    node tests/browser_relay.test.mjs
    node tests/browser_lease.test.mjs
    node tests/browser_provider_cli.test.mjs
    node tests/browser_continuity.test.mjs
    node tests/browser_handoff.test.mjs

The Windows tests use a LOCAL test website and fake HttpOnly login cookie.
The handoff uses two independent MAS service instances on the same test
machine to verify remote routing. A real cross-machine SSH tunnel has NOT yet
been deployed or tested; no real account credentials were accessed.
