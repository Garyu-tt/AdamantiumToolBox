# Windows SSH Transport Guardian R02 (opt-in)

A **replaceable, backend-only** recovery worker. This is not a graphical
front-end, a remote desktop engine, or a new universal control plane.
It is intended to replace one approved SSH tunnel watchdog after testing,
not run alongside it. This PR does not install, enable or restart any task.

## Observed root-cause boundary (2026-11-23)

- The existing `JediControl-Tunnel-Watchdog` holds one SSH process and
  relaunches after an exit with a 15-second delay. It has SSH keepalive and
  `ExitOnForwardFailure`, but no HTTP readiness probe or Wi-Fi-change event.
- On the live laptop `https://localhost:8449/healthz` returned HTTP 200
  with normal TLS validation; `/health` returned 404. This validates a
  candidate transport-level probe for this specific installation.
- The hub `/api/devices` endpoint is a **separate authenticated source**
  and must verify that the Windows agent is online. An HTTP 200 on
  `/healthz` alone does **not** mean control is authorized, a desktop
  session exists, or the remote operator has an active lease.

## Components

- `tools/windows-transport-guardian.ps1`: Windows PowerShell 5.1
  user-context worker with protected loopback HTTPS probe and explicit
  fail-closed exclusive ownership gate.
- `standards/client-watchdog/transport.example.json`: schema and
  non-secret example, not an auto-installed live config.
- `apps/client_watchdog/transport.mjs`: read-only MAS
  `client_watchdog.transport` action, returning sanitized local telemetry.
- The worker stores only bounded status in
  `<config parent>/telemetry/transport-status.json`; the MAS adapter
  reads the corresponding private `%LOCALAPPDATA%/Adamantium Toolbox/`
  client-watchdog path. Keep these aligned for MAS visibility.

## Safe trial

1. Inspect the currently approved tunnel command and its host identity
   with the owner. Back up its Scheduled Task metadata and audit state.
2. Copy the example to the private local
   `client-watchdog/transport.json`, set absolute paths to ssh.exe and
   the approved ssh config, an approved host **alias**, and the verified
   loopback health URL. No secrets are stored in the profile.
3. Run `powershell.exe -NoProfile -File
   tools\windows-transport-guardian.ps1 -ConfigPath <local-profile>`
   with **no** `-Run` switch. It creates only a diagnostic observation
   snapshot and must not start, kill or reconnect SSH.
4. For an exclusive pilot, explicitly stop the OLD tunnel task using
   the operator-approved maintenance procedure, confirm no other owner
   is controlling the desktop, set `exclusiveOwnership:true`, list all
   competing task names, and provide the existing emergency pause marker.
   Only then invoke `-Run` in the user session.
5. The active worker spawns only its OWN SSH child with `-N -T`,
   `BatchMode=yes`, `StrictHostKeyChecking=yes`,
   `ExitOnForwardFailure=yes`, keepalives and command execution disabled.
   It checks loopback HTTPS with normal certificate verification,
   performs bounded retries/jitter, and releases its child on shutdown.
   There is no public listener, raw credential export or UAC automation.

Never deploy two workers to manage the same local tunnel/port. Never turn
off the current JediControl worker until the read-only observation and
live authorized session probes pass.

## Limitations and next acceptance gate

- The process cannot repair Windows sleep, power loss or the network itself;
  it recovers its own SSH child once the underlying network comes back.
- If forcibly killed by OS, an SSH child could outlive the parent;
  the approved operator must check for orphaned tunnel processes before
  allowing another guardian to start. Windows Job Object child containment
  is future work, not claimed here.
- No automatic startup is registered. OS Task Scheduler installation is
  a separate signed/approved lifecycle step, with IgnoreNew concurrency
  and safe reboot/logon semantics.
- Agent liveness and controller authorization need a separate, pinned,
  authenticated server-side proof. Do not treat `transport_healthy`
  as `desktop_available`.
- Windows CI runs parser validation and an actual observer invocation
  that never launches SSH. Real sleep/wake, Wi-Fi roaming, hub failover and
  24h soak are **not yet tested**.

Dependency stack: PR #175 headless Core -> PR #177 client-watchdog ->
this R02 branch. Operational incident: issue #176.
