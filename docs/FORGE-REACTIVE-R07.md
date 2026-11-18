# Forge R07: revision-bound reactive UI projection

The Forge adapter remains **pure and stateless**. It does not subscribe to
streams, persist cursors, inspect real permissions, mutate UI, maintain graph
nodes or coordinate transactions. It must run under Core + Forge alone.

## `forge.reactive.plan`

Input: `forge.reactive.request.v1` with `request_id`, external stream ID,
external cursor (`sequence`, `graph_revision`, `ui_revision`, `policy_revision`),
and 1–128 consecutive `forge.reactive.event.v1` events.

Each event declares `kind` (`publication.committed`, `capability.revoked`,
`ui.mount.changed`), atomic function reference, previous and next graph
revisions, capability/policy revisions, transaction/receipt references, and
explicit UI mount references. Publishing or mounting a visible action also
requires its typed capability `action_id`. `ui.mount.changed` must specify
an explicit desired state (`visible` or `hidden`).

Reject the *entire batch* on gaps, duplicate/replayed sequence numbers, graph
revision forks, policy mismatch, duplicate functions, ambiguous UI mounts or
incomplete event evidence. No UI actions and no cursor advancements are
returned when the batch is malformed. Every rejection has a cause, evidence,
impact and a concrete external remediation path.

Valid output: `forge.reactive.plan.v1` with pure `changes`, an unexecuted
external pipeline and the proposed durable cursor. The external runtime must:

1. Read authoritative commit receipts and reauthorize exact signed providers.
2. Independently verify publication acceptance and permissions.
3. Stage a revision-bound UI diff and CAS commit to the UI provider.
4. Read back affected mounts and published/revoked capabilities.
5. CAS-commit the cursor **only after** successful UI readback.

Raw UI remains the fallback when Leonardo/UI composers are absent. Visual
composition never grants execution rights. Graph Manager and UI Graph own
their own state; Forge only specifies the joining contract. Event batches are
bounded for CPU/memory protection, not by the size of the global graph.

## `forge.reactive.assess`

Input: `forge.reactive.assess.request.v1` with an R07 plan and *externally
provided* UI CAS commit, cursor acknowledgement and individual mount
readbacks. Validate request, graph, UI and policy revisions, the exact
transaction/event set, commit status, visible/hidden action state, every
mount acknowledgement and a cursor tied to the same committed UI revision.

Output: `forge.reactive.assessment.v1` classifying the **supplied receipts**.
Even `consistent-on-supplied-receipts` means neither that signatures were
validated nor that UI is actually live. Forge always returns
`authoritative:false`, `ui_updated:false`, `cursor_committed:false`,
`can_execute:false`. Only host-authorized runtime verification can establish
actual publication. A missing acknowledgement or orphaned UI action triggers
external readback, reconciliation, re-verification and/or revocation.

## Safety and deployment gates

- Core + Forge startup with no Graph Manager, memory, TaskPool or agents.
- No implicit switch of a primary write provider and no retry of ambiguous
  HTTP writes without independent idempotent readback.
- CI: all R01–R07 unit tests plus source budget, architecture lint and MAS
  checks. Windows Chromium suite remains a separate CI gate.
- External integration E2E **not implemented**: signed discovery, CAS UI
  commit, receipt signature validation, real hot-update and durable stream
  cursor belong to independent plugins. No rollout is implied by this PR.
