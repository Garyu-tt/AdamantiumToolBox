# C09 — CodeGraph capability relations (additive)

The existing CodeMap L0/L1/L2 and `/api/codemap/context?file=...&sha=...`
remain unchanged. `mas-codegraph-1` now has an **additive**, versioned field:

    relations_schema: "mas-code-relations-1"
    relations: [{file, from, to, type}, ...]

`edges` continues to contain **only code import edges**. Existing clients
may ignore `relations` and continue working. The new collector reads public
repository-local declarative files; it does not execute applications.

Supported relations:

- MAS `manifest.json`: `runtime`, `view`, `modules` file links;
  declared `connections` between capability identifiers.
- MAS `modules.json`: recursive `contains`, `provides`,
  `consumes_required`, `consumes_optional` relations.
- Frank Addons: `entry` file and `bridge_adapter` capability links.

Every relation retains an origin `file` for traceability. Module and
capability identifiers are typed URI-like references rather than claims
that a backend service is currently running.

Context packs retain the **complete exact target source** and SHA256 guard.
They now include at most 48 related edge summaries and
`truncated_relations`; they do not embed full source of neighbors.
Before editing an existing file: fetch and verify current full content
against the hash; a stale hash raises `stale_hash` and blocks the edit.

Important limitations: lexical JS import parsing is still approximate;
declarations do not imply live availability or authorization. Graph
relations are **not** an authoritative runtime capability registry.
Malformed manifest relation lists are ignored, not executed.
Only files already recognized by the existing repository CodeMap are read.

Tests: `node tests/codemap_relations.test.mjs`,
`node tests/codegraph.test.mjs`, plus full CI and source-budget checks.
