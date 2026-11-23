# ADR: Backend-first MAS rails for client-device software

Status: proposed source contract (not an installed remote-access solution).

## Responsibility split

- **Core**: signed lifecycle, app discovery, capability graph, access policy,
  API routing, audit references, supervisor, crash quarantine and rollback.
- **Headless apps**: independent programs that publish `/health`, `/graph`
  and `/invoke` through the existing MAS 1.0 local contract. Examples:
  device watchdog, remote shell adapter, JediControl adapter, transport.
- **Transport**: an independently installed outbound authenticated channel,
  reconnect and rendezvous. The transport is replaceable; it is not Core.
- **Client UI**: optional and completely outside the device backend.
  A plugin must remain usable from a typed API without opening a window.

The goal is hosting existing, independently maintained software, not
rewriting JediControl, WireGuard, terminal or desktop streaming inside Core.

## Headless MAS 1.0 profile

Declare `"ui":{"standard":"mas-ui-1","mode":"headless"}` in the app manifest.
For this mode an icon and `view.js` are not required, and `/graph` MUST
contain no `view` nodes. Action, resource and event nodes still work.
All other MAS 1.0 fields and permission checks are unchanged.
Bundled headless apps use the existing `apps/<id>/service.mjs` entry.
Signed external plugins follow the existing lifecycle. No new fixed port,
host, token, executable path, or unapproved application is invented.

## Laptop reliability: two distinct watchdog layers

1. **Host service watchdog**: Windows SCM recovery or Task Scheduler at
   boot/logon keeps a minimal service alive. MAS supervisor alone cannot
   resurrect itself after it stops, Windows hibernates, or the user logs out.
2. **Connection watchdog**: client-initiated secure connection with bounded
   exponential backoff and jitter, heartbeats, DNS/network change detection,
   authenticated re-registration and persisted device identity. An expired
   session is renewed, not blindly retried with a stale controller lease.
3. **Interactive desktop companion**: runs in the signed-in user session.
   The service in Session 0 must not fake interactive GUI access. Respect the
   emergency-stop latch, one-controller lease and local UAC consent.
4. **Independent monitoring**: backend distinguishes `host_up`,
   `agent_up`, `transport_up`, `authenticated`, `desktop_available`
   and `control_authorized`. Healthy hub != reachable laptop.

The MAS recovery guard currently covers *spawned apps* and checks their
health/graph. It does not yet supervise arbitrary pre-existing OS services,
persistent outbound tunnels or Windows session companions. Those capabilities
require separate adapters and OS service installation, with explicit approval.

## Remote ChatGPT boundary

A ChatGPT connection requires a real, operator-approved HTTPS MCP ingress
and fresh node-identity + capability/policy verification. An installed
plugin or local loopback listener is not a remote MCP endpoint. Do not
expose Windows RDP, MAS bearer tokens or broker loopback ports to the
Internet. Transport plugins may use WireGuard or pinned mTLS; identities
must be approved, secrets stored locally, and writes audited. Standby may
serve diagnostics but cannot silently accept mutations after primary loss.
Ambiguous timed-out writes require readback and idempotency control.

## Acceptance criteria for remote-desktop adapter (future independent app)

- Windows reboot, logoff/login, sleep/wake, network roam and hub restart
  do not require reinstalling the agent or rotating its identity.
- In each case measure reconnection time, reason codes and success/failure.
- Offline, paused, unauthorized and emergency-stop states fail closed.
- No active controller lease is stolen and no UAC prompt is auto-approved.
- 24-hour soak test tracks heartbeats, process restarts and session recovery.
- Independent Core + headless App tests, package checks and signed rollback.
- No frontend dependency and no architectural hardcoding.

## Verified status on 2026-11-23

The existing JediControl Hub's broker, MCP and Caddy services returned
`active`, but device `desktop-01` reported `online:false` and zero frames.
This is evidence of a client/transport-side outage, not proof of its cause.
The changes in this branch only enable backend-only MAS apps. They do **not**
repair the Windows endpoint, deploy an agent or establish remote MCP access.
