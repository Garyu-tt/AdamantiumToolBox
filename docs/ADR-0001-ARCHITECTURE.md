# ADR-0001: Adamantium Toolbox and Mechanicus architecture

Status: ACCEPTED, mandatory. Machine-readable source: standards/architecture/rules.json

## Rule 1: No architectural hardcoding
Changeable environment values MUST come from user config, a capability manifest,
runtime discovery or declarative data. This includes network endpoints, absolute
paths, permissions, applications, links, navigation, themes, node counts and resource
assumptions. Do not hardcode an optional peer or app to fulfill core functionality.

Allowed constants: protocol and type identifiers, schema version markers, safe
bootstrap defaults required to start before discovery. Their scope must be documented.
Never mistake permission defaults for authorization to execute arbitrary plugins.

## Incremental acceptance
Change one complete capability at a time. Require contract, isolation and regression
tests. Preserve old APIs or introduce versioned adapters/migrations.

## Independence
Microkernel: bootstrap, lifecycle, API registration, authorization, capability discovery.
Growing base: reusable files, settings, events, logging, storage, tasks and UI primitives.
Independent apps: editor, studio, IDE and other tools. Every application MUST pass a
Core + App test without any other optional application. Cross-app connections may be
declared, but must degrade gracefully when the other app is absent.

## CodeForge acceptance gate
1. Source size <=120 lines and <=6144 bytes.
2. MAS manifest and graph validation.
3. Core + App isolation runtime test for each app.
4. No new unjustified fixed endpoints, paths, permission lists, UI color literals or
   direct cross-app imports. Architecture scanner uses historical legacy debt
   fingerprints; new findings fail the gate.
5. Signed artifact integrity and smoke/integration tests before activation.
6. Critic must independently review behavior and test results (not yet automated).

The existing debt list is not blanket approval: exceptions apply only to exact
legacy source lines. Any changed line is scanned anew. Address legacy violations in
small safe migrations, shrinking the debt list after each fix.

Architecture checker is heuristic, not proof of absence of hardcoding. It misses
some dynamic string concatenations, CSS layout constants and implicit coupling.
Apply human/agent review, runtime tests and dependency graph checks as additional gates.

## Storage
Logical storage uses independent, addressable files and typed references. Storage
provider adapters may snapshot/restore those files without changing their paths or
semantic identities. DedupArc is OPTIONAL. It must never be needed for core launch
or for an independent application's normal operation.
