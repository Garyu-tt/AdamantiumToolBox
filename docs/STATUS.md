# Development status
- Branding: Adamantium Toolbox.
- Prepared Windows desktop/Start-menu integration and safe local installation.
- Built-in CapabilityGraph, inspector, CodeMap L0/L1/L2, LinkFS navigation.
- MAS plugin contract; optional editor and Graph Studio.
- PuzzleGrid algorithm is present, not used by all windows yet.
- Signed package validation and local hash store primitives are experimental.
- Mesh Sync v1: signed package inbox, trusted peer push/pull, offline catch-up tested
  across two loopback nodes. No actual cross-server peer connection configured yet.
- Package activation and distributed runtime/state failover are NOT implemented.
- NO production SSO or distributed state consistency.
- Semantic IR v1 is implemented for typed frontend property changes and live backend bindings.
- Plan/apply/rollback, stale-hash blocking, optimistic concurrency and bounded embedded journal tested.
- Arbitrary source-code edits, AST-backed mutation and independent critic still pending.
- Public GitHub repository has not been verified or linked to this tree.

- CodeGraph derives import edges and reverse dependents; Context Pack checks SHA256
  and provides full target code plus neighboring contract signatures.

- Asset routing now reads declarative standards/architecture/assets.json and validates
  registered app IDs, safe types, traversal, and symlinks. Verified in Core + App runs.
