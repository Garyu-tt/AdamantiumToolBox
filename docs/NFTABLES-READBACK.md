# nftables Readback R01 — independent kernel observer

**Status:** independent source-only MAS app. No deployment on VM121/VM122;
no production host firewall, WireGuard or DNS changes.

`nftables_readback.observe({})` reads `nft -j list ruleset` through
a fixed, operator-configured CLI **inside a selected separate namespace**.
Requires `nftables_readback.read`. Uses the normal MAS internal transport
and a loopback HTTP service; never exposes its provider port on ingress.

The operator configures these variables on the process:
- `ADA_NFT_OBSERVE_NAMESPACE`: an existing named namespace
- `ADA_NFT_OBSERVE_NAMESPACE_ROOT`: corresponding namespace handle folder
- `ADA_NFT_OBSERVE_NFT`: approved absolute path of nft
- `ADA_NFT_OBSERVE_IP`: approved absolute path of ip

There are no caller-provided executable paths or arbitrary commands and
no host namespace fallback. The process checks the configured namespace
handle is distinct from `/proc/self/ns/net`; it then runs only:

`ip netns exec <namespace> nft -j list ruleset`

No shell, no arbitrary nft flags, 3-second timeout, 1-MiB stdout cap.
The JSON parser bounds array size, validates families/table/chain names,
counts rules and sets, and generates a SHA-256 revision over the observed
kernel JSON. It exposes table/chain summaries, not full rules or addresses.

## What a revision means

A revision indicates two observed kernel JSON documents differed (or
matched). It does **not** prove who owns the namespace, that a remote
node is trusted, that management access is alive, or that signed
approvals are unexpired. Counters, dynamic sets, kernel version and
nft serialization differences can alter the revision. Treat it as
a best-effort **observation fingerprint**, not an authoritative
transaction precondition without kernel-specific normalization and
fresh attestation.

The path-based namespace comparison is not an atomic identity
attestation: its configured root may differ from how iproute2 resolves
names; namespaces can change between stat and execution. The module
is therefore **read-only** and always returns `readyToApply:false`.

It intentionally has no persistent writes, no `nft --file`, no
`add`/`delete`/`flush`, no kernel apply, and no approval endpoint.

## Native test

On a temporary GitHub Linux runner, CI creates a disposable namespace,
observes its JSON ruleset, creates **one isolated unhooked test table**
through the test harness (not this plugin), observes the added table,
deletes it, and verifies the observed revision returns to baseline.

The test is `tests/native/nftables_readback_real.test.mjs`, guarded by
`ADA_NFT_LAB_DISPOSABLE_ONLY=1` and a CI-specific namespace pattern.
No production namespaces or tables are modified.

This readback plug-in is an **optional graph neighbor** of the
Rollback Watchdog and nftables Lab. Neither plugin imports its code
or depends on its availability to start.
