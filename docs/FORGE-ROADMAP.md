# Mechanicus Forge — decomposed implementation roadmap

This is a **proposed architecture**, not a list of already delivered modules.
The Forge adapter owns contracts only. Each functional line below is a candidate
for a separate one-request implementation node in the global roadmap.

## A. Minimal runtime / contracts

- A01 `forge.describe`: contract discovery (this R01).
- A02 `forge.validate`: atomic function schema validation (this R01).
- A03 `forge.prepare`: unexecuted typed invocation envelope (this R01).
- A04 Protocol evolution: compatible version negotiation (future).
- A05 Typed error/result envelope and transport auth (this R01, MAS host delegated).
- A06 Signature and provenance attachment handshake (future external provider).

## B. Graph Manager — separate recursive plugin

- B01 read and correlate provider-reported capability IDs.
- B02 store typed node/edge revisions in external graph storage.
- B03 maintain forward and reverse dependency indexes.
- B04 detect missing, inconsistent and cyclic dependency relationships.
- B05 stream monotonic graph deltas and cursor-based snapshot catch-up.
- B06 answer `affected_by` and `why_blocked` traversal queries.
- B07 derive task, topology and UI projections without copying canonical state.

## C. TaskPool — existing external owner of work

- C01 admit one atomic function request with acceptance conditions.
- C02 assign stable request ID, idempotency key and revision precondition.
- C03 lease a batch of independent ready requests with configurable concurrency.
- C04 publish completion with verifiable results, not agent-produced claims.
- C05 release lease or requeue after provider crash; bounded retry semantics.
- C06 reschedule invalidated functions when upstream capability version changes.

## D. Capabilities + Code/Build/QA providers — external plugins

- D01 resolve action provider by contract and semantic version.
- D02 invoke action through least-privilege host routing.
- D03 materialize source and artifact references using external storage.
- D04 perform isolated build/test and integrity validation.
- D05 require acceptance evidence and reviewer/critic gates where configured.
- D06 publish/revoke capability with revision and provenance.

## E. UI Graph, Raw UI and Leonardo — external plugins

- E01 derive action controls from verified capability contracts.
- E02 publish a UI contribution with capability ID and permissions.
- E03 dynamically reconcile add/change/revoke without full reload.
- E04 show unverified functions as roadmap proposals, never as active actions.
- E05 link a visible function to reverse dependencies, tests and incident packets.
- E06 apply optional Leonardo layout while preserving Raw UI fallback.

## F. Diagnostics + Fixiki-equivalent deterministic remediation

- F01 normalize incident with cause, evidence and impacted dependent nodes.
- F02 generate ranked fixes with permission/risk/cost annotations.
- F03 attempt safe deterministic fixes through optional remediation providers.
- F04 independently verify each attempted fix and append evidence.
- F05 bound retries and escalate irreparable/unsafe cases with exact reason.
- F06 clear blocked status only after verified dependency restoration.

## G. External provenance / Noosphere 3.0 / history

- G01 record `observed_at`, `recorded_at`, `updated_at` and validity windows.
- G02 resolve compact source-code context, request full file on demand.
- G03 preserve versioned artifact references and SHA-256 evidence.
- G04 materialize distributed memory via provider routes; no memory in Forge.
- G05 export auditable request-to-artifact-to-UI lineage.

## Acceptance definition for one finished development node

One prompt/request leads to exactly one invokable action with typed inputs/outputs;
one or more deterministic acceptance checks; verified artifact provenance;
dynamic published capability; and UI contribution if visible.
Graph and UI state are updated by their **own** providers; Forge never edits them.
Consecutive requests can revisit a node using revision controls. Unavailable
providers yield a diagnosed pending state, never a misleading green success.

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
