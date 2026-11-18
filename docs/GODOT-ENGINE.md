# Godot World Engine / Toolbox MAS plugin v0.1

Status: independent runtime integration, NOT a compiled Godot fork, physics RPC
bridge, renderer implementation, or an installed binary. Base version is the
official Godot 4.7.2 stable release. Do not claim actual 3D or VR capabilities
until an engine is configured, launched and integration tests pass.

## Isolation

- apps/godot is the public capability-graph world-engine gateway. It owns no
  Godot executable, GPU device or simulation state.
- apps/godot_local is an optional CPU-first Godot provider using a configured
  executable. It is independently installable and launches approved projects
  in headless mode. Neither app imports the other.
- Mikoshi Simulacrum owns actors, cognition, memories, world rules, goals and
  canonical state; never engine binaries or Jolt implementation. Consumers
  discover mas-world-engine-router-1 and call the available godot.* actions.
  Simulacrum source was not changed in this release.

## Host configuration and authorization

Runtime environment, NOT source control:
- ADA_GODOT_EXECUTABLE: absolute path to a trusted Godot 4.7.2 binary.
- ADA_GODOT_PROJECT_ROOT: approved directory containing one folder per project.
- ADA_GODOT_SESSION_LIMIT: optional maximum 1..8, default 1.
- ADA_CORE_URL, ADA_TOKEN, ADA_INTERNAL_KEY, ADA_CAPS: provided by Toolbox.

Owner policy requires explicit opt-in to godot.read, godot.launch and
engine.provider and engine.launch. Existing private policy is never overwritten. Review each
executable, project script and dependency before granting launch permission.
Launched game/project code has the privileges of the Toolbox OS user.
Project IDs are directory names, never arbitrary filesystem paths.

## API through the authorized capability graph

Provider resources publish schema mas-world-engine-provider-1, with engine,
version, locality, features and operations of shape {kind,action}.
Operations must point to active actions belonging to the provider app.
Remote providers require an explicit allowRemote request.

Router actions:
- godot.providers: currently authorized engine providers
- godot.engine.inspect: executable compatibility and availability
- godot.project.check: project descriptor inspection
- godot.session.start: opaque sessionId, providerId and starting status
- godot.session.status / godot.session.stop: require both opaque IDs

Current supported launch profile is headless. Stop is best-effort.
Sessions are held in local process memory and lost on provider restart.
The project-scoped startup API does not implement in-world RPC or Godot scene
interactions yet; those require a separately versioned WorldBridge addon.

## Fork evolution

1. Pin Godot source release and exact commit; preserve MIT notices and
   third-party copyright/attribution.
2. Assemble shaders/PostFX/MToon, Jolt, animation/IK, terrain/voxel and VR
   pieces as replaceable GDExtensions or modules wherever possible.
3. Patch the upstream engine only for functions unsupported by public APIs;
   preserve independently testable patches and upgrade paths.
4. Publish desktop, VR and scene-RPC capabilities only after native runners
   and regression suites prove them. CPU/headless must remain usable alone.
5. Implement Godot WorldBridge for world/entity graph, physics/contact queries,
   transactions, time, events, snapshot/restore, scene state and stream transport.
6. Simulacrum should consume the typed WorldBridge contract while Noosphere
   keeps the durable memory. Do not embed the engine inside Simulacrum.

## Acceptance and deployment

Run python tools/check-size.py, python tools/architecture-check.py,
node tools/mas-check.mjs, node tests/godot.test.mjs,
node tests/godot_runtime.test.mjs, node tests/isolation.test.mjs.
Sync the approved source to the Toolbox runtime and restart service supervisor
to discover newly added apps. Dynamic shell navigation and subscribed app provider lists follow graph updates.
This repository change does not deploy binaries to laptop/server.
