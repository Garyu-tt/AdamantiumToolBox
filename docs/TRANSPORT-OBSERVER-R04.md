# Transport Observer R04: safe always-on diagnostics

Scope: attach a **read-only** watcher to an already-running JediControl
SSH/WSS tunnel. No frontend, SSH restart, remote shell, credential import,
interactive controller lease or UAC action is performed.

## Source contract

`windows-transport-guardian.ps1` adds `-Monitor` for continuous probes.
It never starts an SSH process unless given `-Run` with the exclusive
ownership prerequisites. `-Run` and `-Monitor` cannot be combined.
`-MaxChecks N` bounds a diagnostic run for deterministic tests.

In observe-only mode `sshExecutable`, `sshConfig`, `sshTarget` are
unnecessary; they remain **required** for active recovery. This avoids
fabricating an SSH configuration just to inspect existing connectivity.

Probes require normal HTTPS certificate verification to a loopback host,
with no query, userinfo or redirects. Response HTTP 200 from
`/healthz` means **broker TLS is reachable**, not that the Windows agent
is authenticated. Verify the latter independently through the existing
operator-authorized Hub `/api/devices` status.

The `client_watchdog.transport` MAS capability reads private local
`telemetry/transport-status.json`, including `probeOk`, reason, failures,
and observation timestamp. This file contains no bearer token or
SSH key, and is never interpreted as control authorization.

## Deployment

- Keep existing `JediControl-Tunnel-Watchdog` running.
- Review observed health URL. On the owner's laptop on 2026-11-23,
  `https://localhost:8449/healthz` returned 200 with trusted TLS.
- Create a private `mas-transport-guardian-1` config with the approved
  loopback URL, 30-second poll, bounded retries, `exclusiveOwnership:false`.
- Run `powershell -NoProfile -File windows-transport-guardian.ps1
  -ConfigPath <private> -Monitor -MaxChecks 2` for live observation.
- `register-session-companion.ps1 -Observer transport` is the *same*
  SID-verified user-logon task registrar as for the session agent.
  Its default task command is `-Monitor`, with a hidden console.
  `-Approve` performs task registration; absent it is only a dry-run.
  A pre-existing name is never overwritten.

Do **not** enable `-Active` while the old tunnel task owns the port.
Active migration still lacks a verified exact SSH forwarding configuration,
orphan-process containment, authenticated broker witness, and rollback
across a broken laptop connection.

## Testing and remaining work

The Windows CI validates syntax, two successive failed probes with zero
SSH launches, persistence, and a nonmutating generic registration plan.
Real Wi-Fi outage, VPN roaming and sleep/wake need a separate observed
soak before authorizing any automatic reconnect action.

Dependencies: #175, #177, #178, #179; status tracked by issue #176.
