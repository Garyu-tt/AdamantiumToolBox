# Forge R03 — events and deployment gates

## `forge.events.project`

Input:

```json
{
  "schema":"forge.events.batch.v1",
  "stream_id":"external-stream",
  "cursor":{"stream_id":"external-stream","sequence":4,"revision":"revision-4"},
  "events":[{
    "schema":"forge.event.v1","id":"event-5","sequence":5,
    "type":"dependency.changed","function_ref":"demo.feature",
    "observed_revision":"revision-5"
  }]
}
```

This is a **pure reducer of an externally supplied, ordered batch** (1..256) and external cursor. The interface does not own a subscription or cursor. A gap, duplicate/replayed sequence, malformed type, missing publication commit or unexplained incident rejects the whole batch. No partial cursor advance is returned. A valid batch produces **intentions only**, plus `proposed_cursor`; the external coordinator must revalidate graph revision/authorization, apply the instructions and store the new cursor in its own atomic transaction. Forge never commits cursor or triggers UI changes by itself.

Recognized event categories:

- Dependency/provider/permission/contract/artifact/verification changes and `function.invalidated` generate external reverse-impact, invalidation, UI revoke, revisit and diagnostic steps.
- `function.verified` requests an independent publication receipt inspection; it cannot publish directly.
- `function.published` with `commit_ref`, or `ui.contribution.changed`, requests UI refresh with independent runtime readback.
- `incident.detected` requires explanation, evidence, impact and remedies from R02 `forge.incident.validate`.
- `incident.remediation_attempted` requires attempt/evidence references and independent acceptance verification before clearing a blocker.

UI Graph is the owner of displaying/removing live Raw UI commands. It should subscribe to the authoritative event source and use the publication coordinator's committed capability revision. Forge's event projections are advisory; supplying an event does not authenticate that event or bypass the host's policy.

## Service ABI and compatibility

The original MAS HTTP endpoints remain unchanged: `GET /health`, authenticated `GET /graph`, authenticated `POST /invoke`. R03 adds two action nodes with `forge.validate` permission: `forge.providers.negotiate`, `forge.events.project`. Manifest version moves to `0.3.0`, `forge.describe` schema to `mechanicus.forge.adapter.v3`. No Core modifications. The R01/R02 actions preserve their behavior.

## Blockers are actionable, never silent

Any invalid or unavailable provider requirement returns an explicit incident candidate. For missing capabilities: refresh host discovery, inspect approved pinned identity, check permission, and request a primary mapping if appropriate. An event gap requests missing-event replay; a stale snapshot requests re-discovery; a missing publication receipt requests authoritative readback. If external services cannot be reached, Forge reports the exact missing prerequisite, without generating synthetic evidence or attempting unauthorized repair. External, policy-bounded remediation can later attach attempts and results.

## Security and deployment gates

1. Verify MAS Core + Forge alone starts and validates its action graph.
2. Provider snapshot source must be authenticated by host **outside** Forge; do not treat arbitrary JSON booleans as proof.
3. Before provider writes: pinned logical-node identity, exact action permission and fresh revision; ambiguous POST requires readback, not blind retry/failover.
4. Publication coordinator must atomically bind capability and UI visibility; UI stays hidden until verified commit.
5. Event stream and cursor must be durably managed externally and applied transactionally. No direct Forge event listener.
6. No deployment/merge in this PR without the independent integration gates above.

## Next independent milestones

R04 (external integration): host-authenticated discovery adapter, real event delivery + revision-aware UI reconcile, integration tests with mock Graph Manager/TaskPool/UI Graph. These belong in independently installable providers or host adapters, not in Forge's own storage or scheduler.
