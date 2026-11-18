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
