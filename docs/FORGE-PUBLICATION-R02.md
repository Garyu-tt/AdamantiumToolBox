# ADR-FORGE-002 — one functional node, one request, immediate *verified* UI

Status: R02 stateless protocol + plan implementation. Does not claim live execution.

## Canonical ownership

The single external versioned graph is the source of truth. Forge only speaks typed
contracts. Its graph intents and UI drafts are **messages**, not local graph state.
Graph Manager decides link direction, revisions, cycles, forward and reverse lookup;
TaskPool owns admission, batches, leases and reprocessing; the runtime owns discovery,
permission enforcement and function invocation; verification providers own evidence;
publication coordinator owns atomic visibility; UI Graph owns live Raw UI actions;
Leonardo optionally owns layout; Noosphere or another provider owns durable history.
Forge must run without any of these optional services.

## Functional increment

Each `forge.function.v1` has exactly one capability action. One request targets one
function. A caller may run many independent requests concurrently; a function can
be revisited at a new external graph revision. *Every* function produces an
unverified UI draft (generic Raw UI action when no custom UI metadata is supplied),
but it must not be callable until the external provider has verified and published
that exact capability/revision with permissions. The graph of proposed functions
may display pending/blocked nodes in a roadmap, never as fake working buttons.

## New API

- `forge.compose`: returns graph node/edge intents and a Raw UI draft. Nothing stored.
- `forge.publication.plan`: returns a machine-readable transaction recipe with
  discovery, invocation, verification, graph/capability/UI staging, atomic commit,
  and audit steps. `verified`, `published`, `ui_visible`, `provider_bound`,
  `executed` are always `false`; all steps are external and fail closed.
- `forge.reconcile.prepare`: returns a reverse-lookup + invalidation + UI revoke +
  TaskPool revisit recipe keyed by an **externally observed** revision. No own index.
- `forge.incident.validate`: rejects incidents missing explanation, evidence,
  impacted nodes, or actionable remedies; it does not attempt repair.

All action names and ports are *proposals* for providers to implement, not claims
about currently deployed capabilities. The host must do dynamic capability
resolution and authorize every mutation. User-supplied receipts cannot make Forge
mark publication successful. Ambiguous commits require readback rather than blind
retry. An absent transaction coordinator means no publication, not partial UI.

## Publication finite-state protocol

`proposed -> validated -> execution_pending -> externally_verified -> staged ->
 committed -> published` with invalidations moving back to `pending_reverification`.
The publication coordinator must bind the versioned graph revision, capability
publication and UI visibility under one commit decision, or keep the UI hidden.

## Non-goals

No agent, scheduler, graph engine, memory, reverse index, static app listing,
network discovery, file editing, execution, verification, event listener, local
persistence, repair worker, fake runtime, or Leonardo renderer in Forge.
