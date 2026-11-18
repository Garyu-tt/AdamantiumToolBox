# Runtime Recovery v1 (CPU-first)

Policy: standards/architecture/runtime-policy.json.
Optional per-user override: %LOCALAPPDATA%/Adamantium Toolbox/runtime-policy.json.
The supervisor reads it at startup. Change the policy only with an operator review
and restart the AdamantiumToolboxServer scheduled task to apply it.

## Fault handling

Every process has a version-specific fingerprint. The supervisor discovers
registered applications and services without a hard-coded inventory.
All app endpoints are checked for /health and a valid /graph at the configured
poll interval, after a startup grace period. Failed checks terminate an
unhealthy app process, and each unexpected process exit counts as one failure.

Restart attempts have bounded exponential backoff. After crashLimit failures
inside windowMs, the fingerprint is quarantined. The supervisor stops
attempting to launch it, even across service restarts.
The crash register is stored atomically at plugins/runtime-guard.json.

For a signed external plugin, autoRollback=true selects the most recent
previously trusted installed version, or disables a first-time plugin.
It checks that the active package still matches the failing hash. Rollback
is journaled through the normal atomic lifecycle registry.
The previous service is started on the next discovery poll.

Bundled apps, the microkernel and base services do not auto-replace themselves.
For these, repeated crashes result in quarantine until operator intervention.
Manual activation of a previously quarantined hash will not bypass the block.
A new version has a different fingerprint and a separate crash budget.

Default production policy is deliberately more tolerant than the fast test
policy: 5s check interval, 5s startup grace, 2.2s health timeout, four
failures within three minutes, and a two-minute stability reset interval.
These are configurable values, not immutable protocol constants.

## Operator recovery

    node tools/lifecycle.mjs status

Status includes runtimeGuard entries with crash counts, retry timestamps
and blocked flags. For manual recovery, stop the scheduled supervisor task,
inspect plugins/runtime-guard.json and its lifecycle history, and modify
ONLY the specific quarantined fingerprint with informed operator approval.
Then restart the task. Never clear all quarantine state blindly.
If the previous version also fails, disable the affected optional plugin.

## Scope and limitations

- No unattended acceptance of remote or unsigned plugins. A package still
  requires a signed plan, explicit owner authorization, and a successful probe.
- Post-activation failures and graph mismatches can trigger rollback.
  They are not evidence that the plugin is safe.
- No operating-system sandbox, enforced CPU/RAM quota, network isolation,
  untrusted-code containment, or remote-state failover in this version.
- Quarantine and health state are local to each node. They are not yet
  consensus-based across the distributed Mesh.
- A forced operating-system termination may interrupt the last asynchronous
  guard write. The state is intentionally best-effort and atomically replaced.
- No automatic rollback for corrupted plugin-registry records, no guaranteed
  recovery from a broken core process, and no data-schema migrations.

Tests:
    node tests/runtime_guard.test.mjs
    node tests/runtime_recovery.test.mjs
    node tests/lifecycle.test.mjs
