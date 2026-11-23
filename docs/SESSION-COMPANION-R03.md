# Windows user-session companion R03 (opt-in)

Goal: keep the existing JediControl **interactive agent** alive as an
independent headless client-side service, without rewriting its desktop
streamer, bypassing UAC, or putting a frontend in Adamantium Core.

## Evidence behind this workstream (2026-11-23)

On the owner laptop, an SSH tunnel supervisor task was running. Two Python
processes belonged to the interactive JediControl agent. Their process
ancestor was `powershell.exe` running `start-full.ps1`, itself started
from `explorer.exe`. A separate JediControl agent Task Scheduler or
StartupCommand entry was not discovered. Do not infer this is the only
possible user-session launch path.

The agent uses a relative `launch.py` command line rather than the full
path. R03 deliberately matches Python processes in the same interactive
session by the *script file name*. This conservative check may produce a
false-positive when an unrelated Python `launch.py` runs in that session.
That fails closed by suppressing a new launch, never by killing anything.

## Source components

- `tools/windows-session-companion.ps1`: observer by default; `-Run`
  only with explicit local `exclusiveOwnership:true` and an absolute
  pause marker. Session 0 is rejected. A missing agent must be observed
  repeatedly before requesting a launch. Attempts use persisted
  exponential cooldown. It never sends input, grants privileges, clears
  emergency state or kills an existing Python process.
- `standards/client-watchdog/session.example.json`: local-only,
  non-secret configuration template.
- `apps/client_watchdog/session.mjs`: read-only MAS capability
  `client_watchdog.session` exposed under `client_watchdog.read`.
  It reports only sanitized process/launch state, not command lines,
  private paths, cookies, keys, tokens, SSH config or screenshots.
- `tests/session_companion.test.mjs`: stale telemetry, deny/invalid data,
  secret-field omission, symlink rejection.
- `.github/workflows/session-companion.yml`: actual Windows PowerShell
  observer test with an inert fixture script and a required denied
  `-Run` path.

## Deployment policy

1. Confirm the exact owner-approved JediControl launcher and agent
   script, controller lease, current emergency/pause marker, and user
   session. Use a local private config (not this repository).
2. Observe using `powershell.exe -NoProfile -File
   tools\windows-session-companion.ps1 -ConfigPath <private-profile>`.
   No `-Run` means **no launching**.
3. Before active mode, verify and back up existing auto-start/supervisor
   mechanisms, set `exclusiveOwnership:true`, supply the actual local
   emergency pause marker, and ensure the task runs as the **signed-in
   user**, not SYSTEM or a headless Session 0 service. Running/duplicate
   agents must not be restarted or terminated.
4. An opt-in task registrar is included:
   `tools/register-session-companion.ps1`. Without `-Approve` it only
   reports a read-only plan. It accepts exact local profile, exact
   `windows-session-companion.ps1` file and a caller-defined task name.
   `-Approve` creates a least-privileged interactive user-logon task
   in continuous `-Monitor` mode, **without launching the agent or starting
   the task immediately**. `-Active -Approve` is a separate, higher-impact
   option that also requires private `exclusiveOwnership:true` and pause. It will refuse existing names,
   non-interactive Session 0, or an unapproved/pause-less profile.
   `-Remove -Approve` only removes a task whose action exactly matches
   the requested script/config. **No registration is performed by this PR.**
5. Keep the existing tunnel watchdog while session recovery is tested;
   eventually both are independent plugins underneath the Adamantium
   lifecycle. The current agent's local emergency stop and UAC prompts
   remain decisive.

## What this does not claim

- Observing a Python process is not proof that the agent has a live,
  authenticated broker session. The VM125 `/api/devices` result remains
  the authority for device online/frame availability.
- A user must have an interactive Windows session for desktop capture.
  User logoff or an operating-system sleep/power-loss cannot be prevented.
- No remote MCP ingress is deployed. This worker does not make private
  VM125 loopback endpoints reachable to ChatGPT by itself.
- A production-ready launch task, explicit lifecycle rollback, actual
  agent crash injection, network/sleep tests and 24-hour soak still
  require a separate controlled acceptance run.

Dependencies: PR #175 headless Core, PR #177 client watchdog, PR #178
transport readiness/reconnect. Tracks issue #176.
