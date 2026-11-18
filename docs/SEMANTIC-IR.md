# Adamantium Toolbox Semantic IR v1

A headless, typed interface for AI agents. This is not a source-to-source compiler.

API (all local, bearer-authenticated):
- GET /api/graph: live backend capability graph
- GET /api/semantic: frontend nodes + backend capabilities + typed cross-edges
- GET /api/object?ref=component://f.button.files: object description, relations, allowed edits
- GET /api/codemap?level=0,1,2: project map, symbols and full source on demand
- POST /api/changes/plan: dry-run with contract, graph and stale-hash validation
- POST /api/changes/apply: verifies the exact plan and commits one typed modification
- POST /api/changes/rollback: reverses the latest accepted change if revision matches
- GET /api/changes/history: durable journal stored in the same file as frontend graph

Example intent JSON:

    {
      "operation": "modify",
      "target": "component://f.button.files",
      "change": {"property": "title", "value": "Open files"},
      "expected_etag": "<etag from /api/object>",
      "constraints": {
        "preserve_api": true,
        "preserve_permissions": true,
        "validate_dependents": true
      }
    }

Do not invent etag. Ask /api/object for the current revision first.
Plan has plan_id and must be submitted *unchanged* for apply.
Each accepted change adds an audit record in the same atomic frontend JSON write.
Rollback is limited to the latest accepted change and checked for conflicts.
The GUI Graph Studio may still edit whole layouts through a separate legacy route.
This v1 has no arbitrary-code rewrite, source refactoring, cross-process distributed
transactions, or independent critic yet. Only typed frontend properties and
connections to *existing live* actions may be changed.

PowerShell headless:
    node "C:\Program Files\Adamantium Toolbox\tools\agent.mjs" semantic
    node "C:\Program Files\Adamantium Toolbox\tools\agent.mjs" history

The local runtime uses a single bearer token, not production per-user RBAC/SSO.
Future agents must authenticate with scoped capabilities instead of this owner token.

## Dependency solver / Context Pack
GET /api/codemap/graph computes deterministic import dependencies and reverse users.
GET /api/codemap/context?file=core/kernel.mjs&sha=<current_sha256> returns
full target source, symbols, direct dependencies, reverse dependents and their
compact interface summaries. A stale SHA256 is rejected; JS imports are lexical
and partial, while Python functions and imports come from AST.
CodeGraph is not a complete cross-language call graph or formal proof of safety.
CLI: node tools/agent.mjs dependencies; node tools/agent.mjs context <file> <sha>.
