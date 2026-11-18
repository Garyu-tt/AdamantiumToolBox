# Module Lifecycle v1: signed, staged, reversible application selection

Implementation: standards/lifecycle/*.mjs, core/plugin_sources.mjs,
core/catalog.mjs and tools/lifecycle.mjs. This is an OPTIONAL base capability:
the microkernel and any single bundled app work without installed plugins.

## Trust boundaries
1. Mesh receives signed MAS envelopes into the content-addressed store, but
   NEVER executes or activates them automatically.
2. The plan step verifies Ed25519 signature, full SHA256 of the envelope,
   MAS 1.0 manifest and version, owner-approved permission scopes, unique ports,
   absence of migrations and non-decreasing semver within the same major.
3. A remote sender must be configured in mesh/trust.json with BOTH
   receive=true and activate=true. The local owner's own key is trusted.
4. The explicit --approve flag is required for an activation. No unattended
   activation from a remote peer or inbox is implemented.
5. After approval, the candidate is unpacked under
   plugins/installed/<full-sha256>, checked against the signed bytes,
   and probed on an ephemeral localhost port for /health and /graph.
6. Only after the probe succeeds does the registry atomically switch
   plugins/active.json to the new hash. A journal records previous versions.
7. The supervisor detects the changed source path, stops the old service,
   and starts the selected service on its manifest port. Frontend URLs contain
   the active hash, so imports and icons are naturally versioned.
8. A manual rollback selects the last prior signed installed version or
   disables a newly installed app, with an atomic registry update.

This is NOT a security sandbox: a third-party service starts with the same
OS-user privileges and can access local files/network before it is selected.
Only approve independently reviewed code. OS-level isolation, scoped service
identities, resource limits, process-level permission enforcement and
independent adversarial review are still needed for untrusted plugin execution.
The successful preflight probe does not prove runtime stability afterward.
The supervisor now checks runtime health and quarantines repeated failures.
The first release does not support data migrations, breaking major updates,
distributed activation, or OS-enforced execution isolation. Persistent crash
quarantine and post-activation rollback are described in docs/RUNTIME-RECOVERY.md.
Filesystem locks may need manual recovery after process crash.

## Headless workflow
Run from the toolbox installation directory:

    node tools/lifecycle.mjs status
    node tools/lifecycle.mjs plan <package-sha256> > plan.json
    node tools/lifecycle.mjs activate plan.json --approve
    node tools/lifecycle.mjs rollback <app-id> --approve

An existing package is stored via Mesh Sync, or by a locally signed copy in
plugins/inbox. The plan can be inspected and reviewed before approval.
The owner policy is in %LOCALAPPDATA%/Adamantium Toolbox/policy.json.
Permission changes are deliberate, not automatically granted by a plugin.

## Runtime integrity
The catalog keeps bundled apps as first-class sources; a plugin may not override
a bundled app ID or another app's port. A corrupt optional registry does not
prevent built-in apps from starting. Every active plugin file is compared to
the signed immutable bundle at discovery, and extra files or symlinks are
rejected. Installed version folders are not edited in place.

Tests: node tests/lifecycle.test.mjs, node tests/isolation.test.mjs,
node tests/mesh.test.mjs, node tests/assets.test.mjs.
