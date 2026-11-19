# Mechanicus Forge — stateless contract adapter R10

`forge.describe`, `forge.validate`, `forge.prepare` (R01) plus:

- `forge.compose` — an uncommitted graph/UI intent for exactly one function.
- `forge.publication.plan` — an unexecuted typed external publication recipe.
- `forge.reconcile.prepare` — an unexecuted invalidation/revisit recipe.
- `forge.incident.validate` — explainable blocker contract validator.

There is **no graph database, memory, agent, queue, provider execution, resolver,
publication coordinator, dynamic UI composer or background loop** in Forge.
`forge.view` is a small contract inspector, and `/graph` only exposes adapter APIs.
An unverified UI draft is not a runnable button. All external names are proposed
ports, not advertised as installed providers.

Run within the MAS host with `ADA_INTERNAL_KEY` and `ADA_CAPS=forge.read,forge.validate`.
Read `docs/FORGE-PUBLICATION-R02.md` for the transaction/revision protocol and
`docs/FORGE-INCIDENTS.md` for blockers.

## R03 additions

- `forge.providers.negotiate`: pure matching of required external provider ports
  against an externally supplied, revision-bound discovery snapshot; no trust or
  host authorization is conferred by the provided status/identity/policy claims.
  Missing providers and ambiguous primaries return explained issues.
- `forge.events.project`: pure, cursor-bound batch projection of external events
  into unexecuted UI/graph/revisit/verification plans; rejects gaps, replays and
  incomplete blocker descriptions. The cursor belongs to an external service.

R03 retains isolated `Core + Forge` startup and requires no real MAS external
services or agents. Read `docs/FORGE-PROTOCOL-R03.md` for contracts and gates.

## R04 additions

- `forge.integration.prepare`: stateless, explicit-host-target dispatch intents
  with idempotency and revision/policy guards; still no external calls.
- `forge.visibility.assess`: checks revision agreement across *untrusted*
  external evidence for publish/revoke. Never reports authoritative UI state.

The runtime/graph/UI owners alone may invoke or activate a capability.
See `docs/FORGE-INTEGRATION-R04.md` for the host protocol and security gates.

## R05 additions

- `forge.composite.plan` — recursively validates an externally supplied group tree and
  catalog of atomic functions, rejects cycles and ambiguous local capability definitions,
  and produces graph/Raw UI drafts plus one unexecuted work intent per function.
  Functions may appear in more than one group without duplication of handlers or requests.
- `forge.composite.impact` — projects reverse dependency, containment and UI impact
  against an externally supplied revision-bound graph snapshot. Returns unexecuted
  re-verification, UI-revocation and group-refresh intents. It does not alter that graph.

Composite groups are organizational non-executable nodes. The active capability graph,
UI composer, access policy, event cursor and history are owned by **other plugins**.
An external runtime must authenticate the data, authorize the exact provider and commit
atomically before a new action is allowed to appear as executable in UI.

## R06 additions — distributed composition (pure, no host calls)

- `forge.distribution.plan` — validates **explicit** candidate primary placements
  of the R05 atomic function graph on distinct host nodes, previews cross-node
  dependency contracts and proposed staged UI publication. It does not select
  physical hosts, sign requests, resolve permissions or commit.
- `forge.distribution.recover` — interprets untrusted external participant,
  coordinator and UI readback receipts following partial/ambiguous publication.
  Returns explained blockers and external-only fence/readback/reconciliation
  recipes; never blindly retries a write, rolls back or declares a UI active.

See `docs/FORGE-DISTRIBUTION-R06.md`. No agents, memory, queue, graph store,
provider runtime, transaction journal or coordinator have been added to Forge.

## R07 additions — reactive UI revision contracts

- `forge.reactive.plan` — pure, ordered external event projection into a staged
  UI diff, revision CAS commit and durable cursor recipe. Missing events,
  policy forks and conflicting mounts fail closed with explained remedies.
- `forge.reactive.assess` — checks untrusted UI/stream receipts for consistent
  graph/policy/UI revisions, commit status and mount visibility. It never
  asserts that UI actually updated or any capability became authorized.

Details and deployment gates: `docs/FORGE-REACTIVE-R07.md`.

## R08: scoped UI and reconnect

`forge.projection.plan` filters host-supplied UI candidates by revision-bound
allow/deny/revocation claims. `forge.projection.reconnect` classifies replay
versus full resnapshot after disconnect. Both return unexecuted recipes.
They DO NOT authenticate principals, authorize calls, mutate UI or store cursors.
See `docs/FORGE-PROJECTION-R08.md`.

## R09: bounded access leases and revocation evidence

`forge.access.lease.plan` classifies externally scoped, timestamped entitlements
and UI mount invalidations; `forge.access.revocation.assess` requires agreement
of policy, graph scope, runtime denial, UI CAS, readback and event cursor
receipts. All are host claims, never authorization. No clock, sessions,
state, graph, background scheduler or revocation worker exists in Forge.
See `docs/FORGE-ACCESS-R09.md`.

## R10: deterministic blocker remediation (contract-only)

`forge.remediation.plan` proposes externally authorized, reversible, idempotent
safe attempts with bounded budgets; `forge.remediation.assess` compares untrusted
attempt, independent tests, graph restoration, incident and audit receipts.
Neither action executes fixes or clears incidents. See `docs/FORGE-REMEDIATION-R10.md`.

## R11 — graph integrity adapter

`forge.integrity.audit` compares an externally supplied, revision-bound function,
capability, inverse-dependency and UI mount snapshot. Findings explicitly name
causes, impacted nodes and remedies; unverified and ghost UI actions are never
admitted as working controls. `forge.integrity.plan` emits non-executable
external graph/UI reconciliation intents. No internal graph, memory or jobs.
