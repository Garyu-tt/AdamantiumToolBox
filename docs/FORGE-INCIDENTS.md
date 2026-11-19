# Forge incident policy (external runtime contract)

Forge only declares and checks the shape of requests. The following behavior is
mandatory for a future Graph Manager + diagnostic/remediation provider, not code
currently executing in `apps/forge`.

## Required incident fields

- `incident_id`, `node_ref`, `request_id`, `observed_at`, `state_revision`.
- `cause.code`, `cause.explanation`, `evidence[]` and `confidence`.
- `impact.direct[]`, `impact.transitive[]`, `impact.severity`.
- `remedies[]`: id, action, preconditions, risk, permissions, expected result.
- `attempts[]`: executed action, evidence, result, next allowed retry.
- `verification`: criteria, observed outcome, artifact references.
- `resolution`: status, unresolved reason if blocked, owner of next action.

## Incident lifecycle

`detected -> diagnosed -> remedies_proposed -> safe_attempted -> verified -> cleared`

Unsolved cases go to `requires_permission`, `missing_provider`, `risk_exceeds_policy`,
`retries_exhausted` or `verification_failed`, with evidence and actionable next steps.
They never silently disappear and never claim that a remedy was attempted when it
was merely proposed. Safe attempts are idempotent, bounded, and separately audited.

## Example: missing dependency capability

Cause: required capability was not returned by runtime discovery at revision N.
Evidence: snapshot digest, exact lookup contract, provider responses and timestamp.
Impact: dependent function and reverse-reachable unverified nodes.
Remedies: retry discovery after graph-change event, select compatible authorized
provider, repair provider registration, or replace the dependent capability.
Attempt: repeat one bounded discovery probe **only if** diagnostics provider is live.
Verify: successful discovery followed by a typed isolated invocation probe.
Escalate: no provider or no permission — name exact contract needed, not a generic
"cannot proceed" message. UI keeps blocked node visible with clickable evidence.

## Batching and revisits

TaskPool may lease many ready nodes concurrently. Every worker receives a distinct
request id and expected revision; results commit only against the matching lease.
When a dependency changes, Graph Manager propagates invalidation by reverse index;
a scheduler may re-run necessary verification rather than rebuilding the whole tree.
An internal dependency cycle is reported with an actual cycle path and a proposed
edge split, not retried indefinitely.
