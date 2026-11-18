# Forge release milestones R02–R06

## R02 adapter milestone

- A07 `forge.compose`: graph/UI intent envelope — implemented locally, no graph writes.
- A08 `forge.publication.plan`: transactional external recipe — implemented locally.
- A09 `forge.reconcile.prepare`: reverse-impact/revoke/revisit recipe — implemented locally.
- A10 `forge.incident.validate`: cause/evidence/impact/remedies validator — implemented locally.
- A11 Live provider discovery, actual transaction commit, UI hot-reload — **not**
  implemented by Forge; must be independently implemented by runtime/UI/graph apps.

## R03 — source implemented / mock-only verification

- `[x]` Stateless provider snapshot negotiation for publication and reconciliation
  steps; contract/permission/identity checks are *claims*, not host authorization.
- `[x]` Strict external-cursor event projection and revision-bound invalidation
  recipes, with no listener, queue, index, graph, UI mutation or state.
- `[x]` Error diagnostics: expired snapshot, missing/disabled provider, ambiguous
  write primary, missing event, unexplained incident; always with remedies.
- `[ ]` Integration with authenticated runtime discovery, transactional event
  transport and actual UI refresh **outside Forge**.

## R04 — host dispatch and visibility receipt contracts

- `[x]` Stateless `forge.integration.prepare`: produce ordered, revision-bound
  dispatch intents from dynamically negotiated candidate providers; no calls.
- `[x]` Stateless `forge.visibility.assess`: cross-check supplied publication or
  revocation receipts and graph/capability/UI revisions; no authoritative claims.
- `[x]` Fail closed on no idempotency key, absent expected revision, ambiguous
  write primary, stale host readback, mismatched policy/commit/UI or missing
  independent verification; diagnostic remedies always present.
- `[ ]` Host-signed discovery/authorization and real invocation (external).
- `[ ]` Atomic graph/capability/UI publication and hot UI reconciliation (external).
- `[ ]` Transactional external event cursor and replay (external).

## R05 composite contract layer

- [x] Recursive composition draft with one request/work intent per unique atomic function.
- [x] Shared function references across composite groups without duplicate handlers.
- [x] Local typed dependency cycle rejection, reverse index preview, unresolved external ports.
- [x] Pure revision-scoped impact propagation across dependencies, groups and UI drafts.
- [ ] External graph owner authentication, CAS, final atomic activation and rollback.
- [ ] Live UI Graph integration and verified readback, with separate platform end-to-end tests.

## R06 distributed placement and recovery contracts

- [x] Stateless placement proposal for one candidate write-primary per unique
  atomic function, with explicit cross-node typed dependency boundaries.
- [x] No automatic write failover; structural preflight blocks unsupported or
  ambiguous placements and missing externally owned publication coordinator.
- [x] Transaction/revision/receipt cross-check and explained recovery recipes
  for failed, partial, unknown and divergent distributed outcomes.
- [x] Independent Core + Forge HTTP smoke and negative contract tests.
- [ ] Real signed host discovery, coordinated commit/rollback, UI readback,
  durable audit and live Mesh node failover: **external plugin work**, not Forge.
