# Mechanicus Forge — stateless contract adapter R02

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
