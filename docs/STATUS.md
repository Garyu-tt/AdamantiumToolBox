# Development status
- Branding: Adamantium Toolbox.
- Prepared Windows desktop/Start-menu integration and safe local installation.
- Built-in CapabilityGraph, inspector, CodeMap L0/L1/L2, LinkFS navigation.
- MAS plugin contract; optional editor and Graph Studio.
- PuzzleGrid algorithm is present, not used by all windows yet.
- Signed package validation and local hash store primitives are experimental.
- Mesh Sync v1: signed package inbox, trusted peer push/pull, offline catch-up tested
  across two loopback nodes. No actual cross-server peer connection configured yet.
- Signed package activation and local crash recovery are implemented; distributed runtime/state failover is NOT.
- NO production SSO or distributed state consistency.
- Semantic IR v1 is implemented for typed frontend property changes and live backend bindings.
- Plan/apply/rollback, stale-hash blocking, optimistic concurrency and bounded embedded journal tested.
- Arbitrary source-code edits, AST-backed mutation and independent critic still pending.
- Public repository: https://github.com/Garyu-tt/AdamantiumToolBox; main is CI-checked.

- CodeGraph derives import edges and reverse dependents; Context Pack checks SHA256
  and provides full target code plus neighboring contract signatures.

- Asset routing now reads declarative standards/architecture/assets.json and validates
  registered app IDs, safe types, traversal, and symlinks. Verified in Core + App runs.

- Optional Mesh API and worker are now loaded through discovered system-service
  manifests in services/, with add/disable and path validation tests.

- Lifecycle v1: signed package plan, explicit approval, isolated health/graph probe,
  content-addressed install, atomic activation registry, rollback and live discovery.
- No OS sandbox or distributed activation in v1; package execution requires approval.

- Runtime Recovery v1 adds per-version crash quarantine, capped exponential retry,
  atomic guard-state persistence, health/graph checks and conditional auto-rollback.
  Validated by an end-to-end crashing plugin and last-good recovery on Windows.
- No OS sandbox or CPU/RAM quotas yet. See docs/RUNTIME-RECOVERY.md.

- Chromium Browser MAS v0.1: installed Edge/Chromium autodiscovery via registry,
  isolated temporary profile and localhost CDP. Typed tabs, navigation, back,
  forward, reload, screenshot, click and input actions with owner permissions.
  Live screenshot panel in Toolbox; native WebView2 embedding is still future.
- Windows live browser test passes on a local website without external accounts.

- Browser Core integration verified: API graph, LinkFS navigation, UI assets,
  delegated typed screenshot invocation through a local fixture website.
