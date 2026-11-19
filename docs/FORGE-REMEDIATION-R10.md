# Mechanicus Forge R10: explained deterministic remediation contracts

Forge remains an **API-only, stateless** adapter. It has NO agent executor,
repair worker, memory, graph store, TaskPool, approval store, background loop,
secret, privileged runtime or authority to clear blockers.

## `forge.remediation.plan`

Input: a complete explained incident (`cause`, evidence references, affected
nodes, actionable remedies) plus an *untrusted* revision-bound graph/policy/
incident snapshot with externally recorded attempt counts and provider claims.
Each remedy has stable `remedy_ref`; safe candidates also need `reversible:true`,
a durable `idempotency_key` and independent `acceptance_checks`. Request-wide
attempt budget is 1–3; each safe remedy must have a durable journal counter,
even when its count is zero. Only one candidate is scheduled per readback cycle.

Only `risk:safe` entries with these safeguards become **unexecuted** candidates.
Permissioned and manual repairs are explicitly deferred. Exhausted, unsafe and
missing-provider conditions produce named reasons with the next diagnostic or
approval action, not a meaningless `blocked` flag. Safe status is a *claim*:
real host revalidates risk, target identity, current policy and readback.

The adapter does not invoke `remediation.attempt.safe`. It emits an external
recipe: refresh incident + graph, recheck provider/policy, request bounded
idempotent remediation, verify acceptance and record a fresh incident outcome.
No silent failover, retry after ambiguous result or implicit approval.

## `forge.remediation.assess`

Cross-checks five external receipt **claims**: attempt, independent acceptance,
graph restoration and reverse-dependency coverage, incident resolution and
audit. External verification must identify a provider distinct from the executor,
and audit evidence needs a durable record reference. All five must refer to
the same incident, remedy, attempt and revision
set. Missing, stale, cross-operation or incomplete receipts produce actionable
readback/reconciliation suggestions. A matching result only means
`evidence_consistent:true`, **never** `cleared:true`, `verified:true` or
`authorized:true`; only the external authoritative incident owner may clear it.

Neither endpoint persists an attempt counter or incident. Loss of external
attempt history is a stop condition rather than permission to restart retries.

## Test gates

`node tests/forge-r10.test.mjs` checks safe/permissioned separation, bounded
attempts, reversibility, deterministic acceptance, duplicate/stale receipts,
explicit impact coverage, standalone MAS HTTP authorization and no false success.
Run R01–R09 regression and source-budget checks before publication.
