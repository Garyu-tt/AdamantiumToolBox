# ADR AN-C01 — Mechanicus consumers migrate to Adamantium-node

**Date:** 2026-11-19 · **Status:** proposed migration contract; NO active deployment.

The owner's Node-RED fork at https://github.com/Garyu-tt/adamantium-node is the **preferred visual editor and composition workbench** across AdamantiumToolBox, GENESIS, ALT and other Mechanicus applications.

This supersedes the *editor selection* in Universal Graph issue #141 (which previously selected Rete.js v2) but **does not supersede the Universal Graph IR, its native CPU-first validator/executor work, or the separate Adamantium Genome project**. Keep existing branches and accepted tests intact until reversible cutover.

## Source of truth / ownership matrix

| Concern | Authoritative owner | Adamantium-node role |
|---|---|---|
| Typed nodes, ports, edges, composites, revisions | Independent Universal Graph IR (#141/#143) | Safe projection and planned edits |
| Capability catalog, rights, target identity | MAS Core / Registry / Policy | Discovery UI; never grants permissions |
| Execution, leases, retry, QA, rollback | Graph Manager / Task Pool / Conductor / Fixiki / Lifecycle | Visual debugger/status, optional event-flow executor |
| GENESIS genotype, expression, heritage (#147) | Adamantium Genome plugin + GENESIS providers | Genes/phenotypes visual editor, inert plans |
| ALT × GENESIS compressed neural weights | Dedicated artifacts/restoration provider | References, structure and metric visualization only |
| Dante sensory, brain, motor, world | Independently authorized GENESIS/Dante runtime | Domain-specific live graph view |
| WireGuard tunnel creation and access | Authorized network provider + approved identities | Topology graph with explicit read/write boundaries |
| Noosphere data/history | Noosphere 3.0, separate durable store | Knowledge/timeline visualization only |
| UI composition and menus | Dynamic Graph UI provider | Composable viewport/widget editor |
| Android Adamantium AI Core | Android runtime + device policy | Remote view of published, opt-in capabilities |
| Adamantez secrets and privileged providers | Private authorized boundary | No secret ingestion into public flow exports |

## Non-negotiable invariants

1. **Do not make Node.js or Node-RED mandatory for headless MAS Core, Graph IR, GENESIS expression or native runtime.** CPU-only Core+one-plugin is still a required smoke test.
2. Node-RED `flows.json` is an editor/compatibility projection, not canonical Graph IR. Lossless, versioned transformation (including unmappable opaque typed metadata) must be measured before any write enablement; lossy views are read-only.
3. A drawn `permission` edge is not an RBAC grant. A `network` edge is not a successfully established tunnel. A `dependency` edge is not an executable flow. Neural feedback must declare delay and bounded scheduling.
4. GENESIS genotype → expression plan → measured phenotype remains distinct. Learned/experimental gene overlays and compressed weight/residual artifacts are external, immutable or versioned, content-addressed and independently verified.
5. No hardcoded IP, WireGuard endpoints, host names, keys, paths or model/hardware requirements. No production secrets in a public repository or UI flow.
6. All host-affecting writes go through current authorized MAS capabilities, explicit target and signed Lifecycle/canary; no direct Node-RED `exec`/shell/deploy escape hatch.
7. Existing unmerged Rete editor work (#145) becomes an **optional historical/alternative UI adapter**, not a reason to erase existing G0/Genome tests or rebase other active bot PRs.
8. Every migration is stageable, reversible, journaled with base SHA/source revision, CAS, independent QA, and readback of actual host state; write approval is not inferred from a diagram.

## Execution packets

- **AN-C01 / NOW**: build Adamantium-node fork R01 docs and inert typed editor-projection tests (separate repository/branch). Preserve upstream Node-RED license and source history.
- **AN-C02**: narrow native Graph IR adapter. Verify G0+G1 typed round-trip with edges `data/control/event/signal/network/permission/dependency/feedback`, composite references and schema/version provenance. Make failures visible; never silently flatten semantics.
- **AN-C03**: render graph in Node-RED fork as inert editable/collapsible groups; editor changes emit a proposed signed/diffed plan to Graph Manager, no direct runtime mutations.
- **AN-C04**: independent Graph Manager/Registry/Task Pool/Conductor/Fixiki QA bridge with bounded leases, recovery branches, permission fencing and attestation.
- **AN-C05**: GENESIS graph adapter (structural genes, learned overlays, expression planner); ALT weight reconstruction plugin uses content-addressed matrices/shards outside editor JSON. Verify exact or explicitly bounded-loss restoration and streaming RAM budget.
- **AN-C06**: adapters for Dante, WireGuard, DNS, Noosphere 3.0, Android AI Core, composable UI and storage. One adapter per MAS plugin; no God Object.
- **AN-C07**: full system cross-graph observability with operator-approved canary, rollback and only then default editor switchover.

## Migration proof requirements

Every packet reports: source commit SHA, changed paths, test command and exit code, independent review, artifact hashes, feature-flag value, rollback method and actual deployed/not deployed status.

**Current R01 is architecture + isolated library only.** It does not replace running services, migrate persistent genomes, or deploy to VM121/VM122/Windows. Any subsequent move must preserve this contract and acquire authorized host access.

Related live work: #141 Universal Graph, #143 native G0, #145 Rete editor, #147 Genome; Dante P0 #47. Fork specification: https://github.com/Garyu-tt/adamantium-node/blob/architecture/adamantium-node-foundation-r01/docs/adamantium/ARCHITECTURE-R01.md
