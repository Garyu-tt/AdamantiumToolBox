# Forge R06 — distributed composition contracts, not a distributed coordinator

Status: **source + local tests, not a deployed MAS capability graph**. This
revision extends the stateless adapter R01–R05 with **two pure APIs**. The Forge
process has no graph store, memory, agent, worker, TaskPool, lease, subscription,
provider resolver, UI mutation or transaction coordinator. It can run with only
MAS Core + Forge.

## 1. Logical model and roles

The Mechanicus whole-system graph remains **one logical, typed, bidirectional
capability/dependency graph**, held externally. Every independently invokable
`function` has one development request (R05), one unique functional contract,
and any number of UI mounts via `contains`/`displayed_as` edges. Modules and
composite groups do not execute. Deploying the same contract to several nodes
is a provider-placement decision, **not** a duplicate development request.

- Forge: pure contract, validation, projection, proposed dispatch/recovery recipe.
- Graph Manager: authoritative, revisioned nodes/edges and reverse index.
- TaskPool: queues, ownership, retry leases and batch concurrency.
- MAS Core + Mesh: operator-approved node discovery, pinned identity,
  exact provider policy, mutual authentication, all invocation.
- Verification provider: independent execution/acceptance evidence per function.
- Publication coordinator: external fencing, transaction journal, CAS,
  staged graph/capability/UI, reauthorization and readback.
- UI Graph / Raw UI: only verified, committed, policy-authorized actions become
  clickable; Leonardo affects presentation, never functional authority.
- Diagnostics/Remediation: real incident observation, bounded repairs and
  validated results. No unexplained blockers; none executed inside Forge.
- Noosphere: external history/provenance and optional distributed memory.

## 2. `forge.distribution.plan` (pure)

Input: `forge.distribution.request.v1` with `request_id`, the external graph,
policy, and discovery revisions, a full `forge.composite.plan.v1` R05 output,
`placements` (one explicit candidate **primary** per atomic function), and an
optional explicit external `coordinator` candidate. Each candidate has
`function_ref`, `node_ref`, `provider_ref`, `action_id`, `contract_version` and
preflight claims (`status`, `primary`, `identity_pinned`, `policy_allowed`,
`can_invoke`). **These claims are untrusted.** Never derive authority from them.

Output: `forge.distribution.plan.v1` with function target proposals, cross-node
`depends_on` links, UI contribution references, an external-only staged
publication sequence and explainable blockers (`cause/evidence/impact/remedies`).
`complete=true` means that the *supplied* data passes structural preflight,
NOT that the node is active, that a signature is verified or that publication
may happen. Every step has `executable=false`. Missing primaries, ambiguous
placements, version mismatches, unresolved external dependencies, expired/revoked
providers or missing coordinator may not be silently ignored.

The host must re-resolve each action, verify actual pinned node identity and
current policy, confirm revisions with CAS, authorize each call, and require
independent acceptance for each function before staging. A multi-node
transaction cannot be assumed atomic from separate successful HTTP responses:
the external coordinator must implement fencing/transaction journal and
verified visibility readback. If it does not exist, publication remains blocked.

## 3. `forge.distribution.recover` (pure)

Input: `forge.distribution.recovery.request.v1`: stable operation/request IDs,
original graph and policy revisions, publish/revoke mode, one unique record per
participant with unique function references and observed status
(`not_started|prepared|committed|failed|unknown`), an external coordinator
record (`absent|prepared|committed|aborted|unknown`), and a UI readback
(`visible|hidden|unknown`). `committed` claims need matching operation ID,
committed revision, policy revision and receipt reference. The UI and coordinator
must identify the same transaction/revision for a consistency classification.

Output: `forge.distribution.recovery.plan.v1` with a **candidate** classification,
explicit incidents and external readback/fence/reconcile intentions. Receipt gaps,
unknown outcomes, divergent participant revisions, partial commits, policy
mismatch and UI shown before global commit are explained with safe paths.

**No blind retry after an ambiguous write**. The adapter never retries,
compensates, fences, revokes, hides UI, persists receipts or returns
`can_execute=true`. Even `consistent-on-supplied-receipts` is untrusted and
requires authoritative signed host readback.

## 4. Deployment / acceptance gates

1. Core + Forge-alone smoke: `/graph` lists both R06 APIs, `/invoke` requires
   MAS-delegated key and Forge permission, no extra process is needed.
2. Unit tests: shared function mounts, cross-node dependencies, explicit primary,
   missing/duplicated targets, rejected major versions, external dependencies.
3. Negative recovery tests: status unknown, partial write, orphan/visible UI,
   divergent revisions, duplicate function/participant, mismatched policy.
4. External platform E2E (NOT yet done): approved Mesh identity + policy,
   independent verifier, transaction journal, atomic UI staging, recovery
   readback and host audit. Fail closed if any component is unavailable.

The adapter has bounded input limits for CPU/process safety; these are **not**
a permanent upper bound on the global distributed graph. Full graph revisions,
actual permissions, durable event cursors and storage remain exclusively under
external ownership.
