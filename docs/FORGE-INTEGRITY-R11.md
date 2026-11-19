# R11 — external graph integrity contracts

Forge remains a thin, stateless API adapter. This release supplies two pure
operations; neither owns the graph, reverse index, UI, policy, artifacts, agent
runtime, task queue, audit log nor remediation executor.

## `forge.integrity.audit`

Read-only structural + semantic audit of a *complete, supplied, untrusted*
`forge.integrity.snapshot.v1` with per-system revisions and stable references.
The snapshot contains function nodes, capability registrations, UI mounts and
reverse-dependency index entries. Bounded to 256 functions, 512 capabilities,
1024 mounts, and 256 inverse-index entries. Work requests identify exactly one
function; shared UI mounts still reference the same function.

Checks include missing/dangling forward and reverse links, duplicate work IDs,
dependency cycles, unpublished dependencies, missing verified handler-backed
capabilities, orphan mounts, UI actions that claim to be invokable without a
verified publication chain, and blocked nodes without evidence and remedies.
`ok:true` means the snapshot is structurally acceptable, **not** that a host
has verified it. `consistent:true` is local mathematical consistency only.
All findings have cause, impacted refs, untrusted evidence and a remedy hint.
Over 256 findings are explicitly truncated and require external resnapshot.

## `forge.integrity.plan`

Consumes the untrusted result of `forge.integrity.audit`, checks schema, counts,
revision set and supported issue codes, then emits *unexecutable* external
readback/reconciliation steps. Most dangerous UI ghosts are handled by proposed
fail-closed UI invalidation; reverse-index drift requires a revision-bound
rebuild by Graph Manager; duplicate requests/cycles require manual investigation.
No automatic graph writes, retries, agent calls, merges, approvals, cursor updates
or UI mutations occur in Forge. All candidate action ports must be discovered
and authorized at the moment of host invocation. A plan is not permission.

## Integration acceptance

External Graph Manager owns authoritative graph and reverse index; TaskPool owns
request admission; Capability Runtime owns executable handlers; UI Graph owns
mount visibility and per-client permissions; Diagnostics owns incident lifecycle.
The trusted host must pin provider identity, validate policy, perform CAS, audit
changes and independently verify readback before reporting success. Independent
functions can remain headless; a published function does not require a UI mount.
The client may display proposed functions as roadmap nodes but never as
invokable actions until the host confirms the complete chain.

`node tests/forge-r11.test.mjs` tests no phantom UI, reverse drift, requests,
cycles, blocked nodes and standalone MAS auth. Run prior Forge suites R01–R10
and source/architecture lint before merging. No MAS deployment is implied.
