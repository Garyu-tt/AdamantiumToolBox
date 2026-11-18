# Mechanicus Application Standard (MAS) 1.0

Contract for independently running apps, compatible with Workbench, alternative shells and agents.
No shared runtime, programming language, or mandatory broker. Shell is an optional client, not the center.

## Manifest
Each app keeps its manifest at apps/<id>/manifest.json. Required keys:
mas, id, name, version (semver), icon, lifecycle=independent,
service={protocol:mas-http-1,port}, ui={standard:mas-ui-1,mode:embedded-and-standalone},
auth={mode:host-delegated}, permissions, events={schema:mas-event-1},
data={refs:mas-ref-1}, updates={strategy:semver,migrations:[]}.

## Runtime discovery
Service MUST implement /health and /graph, and /invoke if it advertises actions.
Discovery requires a valid manifest and a healthy service. It is not a menu hard-coded in the shell.
Graph node IDs MUST be namespaced app.id and carry required permission scopes.
No UI element is displayed for unavailable capabilities. Unknown MAS major versions are rejected.

## Three contracts, two separate graphs
Backend graph contains typed actions, resources, views, events and permission requirements.
Frontend graph contains tabs, buttons, labels, connector instances, coordinates and containment.
Bridge edges explicitly bind frontend widgets to backend capabilities.
Bridge is NOT authorization. Every invocation must be checked against live backend capabilities.
Frontend and backend are separately versioned and stored.
The Graph Studio editor can display both graphs in parallel.

## UI and behavior
Shared standards/ui/kit.js and standards/ui/mas.css provide reusable controls and theme tokens.
Each app may implement its own domain UI. For supported operations, common semantic behaviors:
mas.object.open, mas.object.properties, mas.object.actions, mas.object.move, mas.object.history.
Double click, context menu, object properties, drag operations and keyboard accessibility
must be consistent when a capability is actually supported.
Drag by itself never grants authorization or mutates data.
App windows can be embedded or launched in independent host windows.

## Events, object references and authorization
Typed object reference: mas://<app>/<type>/<percent-encoded-id>
Event envelope: {schema:"mas-event-1",id,kind,subject,ref,time,payload}.
Transport pluggable, delivery semantics and retries adapter-specific.
No cross-process delivery guarantees are implied by this prototype.
Auth mode host-delegated describes the local bearer-token prototype, not production SSO.
Production OIDC/PKCE, per-user scopes, delegation and auditable roles remain separate tasks.
Never pass a local prototype bearer token to external services.

## Versioning and release gates
MAS major and graph schema major changes are compatibility boundaries.
Migrations must be idempotent, backed up and tested before destructive changes.
Do not run unsigned auto-updates or execute remote manifests as code.
A user-defined visual connector does not create privileged backend abilities.
Each source file is <=120 lines and <=6144 bytes, including generated templates.
Generated binary assets are exempt but the icon generator source is not.

## AgentForge / CodeForge integration contract
Before accepting an application: validate source budget, manifest, graph, icon files,
permissions, service independence, local auth and standalone/embedded launch.
Run python tools/check-size.py and node tools/mas-check.mjs.
The generator node tools/new-app.mjs <app-id> creates a proposal under drafts.
Generated proposals must be explicitly tested and promoted to apps before becoming visible.
This is an acceptance contract; integration into existing AgentForge pipeline is not yet deployed.

## LinkFS
Use the on-disk directory tree interface/ as the source of navigation.
Folder renames and new folders affect the menu on the next graph refresh.
References are small .appref.json pointers to a live view, not copies.
Optional manifest connections can declare cross-module graph relationships
but are exposed only when both endpoints are real, active and authorized.

## Extensible base services
Optional infrastructure services register with a mas-system-service-1 document in
services/<id>.json. Each declares id, runtime=node, relative entry and enabled.
The supervisor discovers, starts and stops these services dynamically. No app
requires a particular base service unless that capability is explicitly declared
in its own contract. Core + App tests exclude all optional base services.
