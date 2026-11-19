# Claude work orders — AdamantiumToolBox SDK roadmap

Every task is an independent PR, with **no implicit rewrites**. Before changing
an existing file, use CodeMap L0/L1 context and fetch full current source at
its exact SHA. If SHA changes before commit, stop and reread. No hardcoded
infrastructure, navigation, credentials, or optional application imports.
Preserve MAS 1.0 and run Core + App and existing CI on every PR.

## C01 — Contract audit (read-only)
**Input:** `core/contract.mjs`, `core/catalog.mjs`,
`standards/MAS-1.md`, `docs/LIFECYCLE.md`.
**Deliver:** capability/manifest contract matrix, versioned extension proposal,
identified conflicts and rollback triggers; no source edits.
**Accept:** evidence includes real file SHA and line-level references.

## C02 — Runtime module dependency negotiation
**Input:** SDK v0.1 `mas-modules-1`, existing graph and service routes.
**Deliver:** generated app uses the exact resolver and rejects malformed
module changes atomically; unmatched mandatory *local* dependencies hide only
their dependent modules. External dependencies remain optional.
**Accept:** toggle any nested module; no invalid action reachable; no Core changes.

## C03 — Typed action validation
**Input:** existing `/invoke` MAS 1.0 contract.
**Deliver:** documented supported JSON Schema subset or an independent
versioned validator adapter; fail closed for unsupported schemas.
**Accept:** adversarial input/output tests; no capability privilege escalation;
MAS 1.0 legacy actions still execute through compatibility fallback.

## C04 — Graph push subscription
**Input:** existing `/api/graph`, shell `refresh()`, auth model.
**Deliver:** authorized graph revision events with shared bounded polling or
push-source; client authenticated fetch stream and polling fallback.
**Accept:** install/disable/permissions changes reflect without page reload;
no token in URL, no stale action invocation, no open socket leak, no extra
optional app needed. Core + App test.

## C05 — Port/endpoint allocation adapter
**Input:** MAS 1.0 static service.port.
**Deliver:** opt-in versioned dynamic listener rendezvous and supervisor
resolution; old manifests continue to work unchanged.
**Accept:** two isolated apps with no fixed port collision on Linux/Windows;
no Core source hardcoded app ID, URL, or port.

## C06 — Signed module activation/rollback integration
**Input:** `standards/lifecycle`, `core/background.mjs`, runtime guard.
**Deliver:** module state transition plan, permission delta, health preflight,
atomic selection, previous-version recovery; no unsigned activation.
**Accept:** crash, tamper, downgrade, and rollback simulations; existing
signed MAS 1.0 lifecycle tests stay green.

## C07 — Frank Addons SDK adapter
**Input:** `frank-addons/bridge` and `apps/frankenstein`.
**Deliver:** template under `frank-addons/<language>/<addon>` that bridges
published typed capabilities but never imports a classic MAS plugin directly.
**Accept:** single Frank addon with bridge and Core; no source tree mixing;
unavailable language adapter produces a typed unavailable status.

## C08 — Cross-platform adapter matrix
**Input:** path/process/listener/fs semantics in SDK and runtime.
**Deliver:** independent `platform.*` capability contracts and Node
adapters for Windows and Linux without OS branches in app business logic.
**Accept:** Windows + Linux CI, invalid path traversal tests, no fixed roots.

## C09 — CodeGraph relation enrichment
**Input:** existing `tools/codemap*.py`, `/api/codemap/context`.
**Deliver:** add manifest/module/provider/consumer edges to L0/L1 map, with
bounded neighbor summaries, exact target source on demand and SHA precondition.
**Accept:** nested module and reverse-dependency tests; no source snippets
guessed from a stale map; unchanged L0/L1/L2 API compatibility.

## C10 — Generator acceptance pipeline
**Input:** `tools/new-app.mjs` and `tools/mas-check.mjs`.
**Deliver:** draft template tests for valid icon assets, health, graph,
permission denial, standalone and embedded UI, signed packaging proposal.
**Accept:** no draft auto-activation, no overwrite, no dependency on other
optional apps, source <=120 lines and <=6144 bytes, full regression suite.

## Acceptance evidence for every Claude PR
- Base SHA, target file SHA, actual full-source read, precise changed paths.
- Old contract vs new contract compatibility table.
- Tests executed and their real output; missing tests marked NOT RUN.
- Core + one plugin (including optional providers missing) tested.
- Event/API privileges verified; changes reversible and no credentials committed.
