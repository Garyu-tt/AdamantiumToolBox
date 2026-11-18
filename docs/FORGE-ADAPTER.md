# ADR-FORGE-001 — Mechanicus Forge as a stateless contract adapter

Status: R01 design + isolated adapter implementation; NOT a scheduler or graph engine.

## Boundary

`apps/forge` is a MAS app that publishes an API surface and machine-readable rules.
It does not store nodes, own a database, run workers or agents, compute a roadmap,
mutate source, dispatch external calls, render the live graph, or repair infrastructure.
A caller may read contracts, validate one atomic function description and produce a
routable **unexecuted** request envelope. Only a host-verified provider may execute it.
A `forge.view` is a minimal stateless contract inspector for today's Core+App UI rule.
Its UI is not a second graph editor or layout engine.

## One graph, several external views

The *system*, not Forge, owns one canonical versioned graph with several projections:

- Topology: host -> app/plugin -> recursive modules -> function -> capability.
- Development: project -> epic -> feature -> atomic function -> test/evidence.
- Runtime: request -> function -> provider -> execution -> result.
- UI: published capability -> UI contribution -> Raw UI/Leonardo view.
- Diagnosis: failed check -> incident -> impacted nodes -> remedy -> attempt -> proof.
- Provenance: revision -> source/artifact -> signature -> verification.

The `contains` relation is a recursive tree projection. Dependencies are not a tree:
they are a general typed directed graph with reverse lookup. Graph Manager owns
bidirectional indexes; it must not manufacture a second source of truth. Cycles in
`depends_on` must become explained incidents instead of silently stalling execution.
A single node may have several parents through typed relationships, but containment
has a single owning parent per revision to avoid ambiguous lifecycle ownership.

## Atomic function invariant

One `forge.function.v1` describes **one** independently invokable capability action,
with a stable namespace ID, typed input/output, goal, acceptance criteria, dependency
references, and optional UI contribution. One invocation carries one target action;
repeated invocations, revisions and subsequent revalidation are supported externally.
A batch is a collection of separate requests, not a giant uninspectable function node.
If an objective needs several actions, split it into child functions before admission.
The validator checks structural properties, **not** provider availability, test pass,
security authorization, source integrity or production readiness.

## API implementation

MAS `/graph` publishes only the Forge adapter's own nodes. `forge.describe` returns
`protocol.json`; `forge.validate` returns a typed validation outcome;
`forge.prepare` returns an unexecuted, unbound invocation envelope.
`/health` exposes only the adapter's process state. The internal transport requires
an authenticated key; individual invokes additionally check host-granted permissions.
The current adapter intentionally exposes no graph write, task claim, runtime agent,
revision history, provider binding or auto-fix endpoint.

## External composition (proposed capability slots, not live dependencies)

`graph.snapshot.read`: Graph Manager / capability graph's snapshot and reverse index.
`tasks.work.claim`: TaskPool's existing durable queue, lease and idempotency.
`capability.resolve`: dynamic typed discovery and invocation in host runtime.
`ui.contribution.publish`: UI Graph's publish/revoke and declarative action metadata.
`diagnostic.incident.report`: diagnostic packet, cause, impact and affected nodes.
`remediation.attempt.safe`: bounded, deterministic, separately permissioned repairs.
`provenance.record.append`: immutable evidence and signatures in a storage provider.

Names above are forward-looking contracts. They are **not** claims that current Core
implements them. If absent, Forge remains a usable Core+App contract inspector.
No optional peer hostname, app ID, agent name, theme or dependency is baked into code.

## Publication transaction — outside Forge

1. Persist atomic function proposal in TaskPool or other authorized work provider.
2. Resolve required capabilities dynamically and check permissions/compatibility.
3. Route one request to a provider, with request ID and revision precondition.
4. Run acceptance checks, integrity and independent verification against the result.
5. Commit capability publication and UI contribution as one versioned visibility step.
6. Emit change event. UI reconciles capability IDs without page reload.
7. On invalidation, revoke action visibility or mark it unavailable with a reason.

No step may label a simulated envelope an actual execution. If the publishing
providers cannot provide atomicity, they must expose a pending revision that is
not available for invocation, then switch to verified visibility on commit.
