# nftables Lab R01 — isolated, non-applying syntax check

Status: **source prototype only**. Not deployed on VM 121, VM 122 or any
production host. GitHub Actions creates a disposable Linux namespace;
only its **unhooked test table** is briefly created and deleted.

## Capabilities

This is an **independent** MAS app: it boots as Core + nftables_lab only,
without Graph DNS, Graph Firewall, Noosphere, WireGuard or nftables Preview.

- `nftables_lab.check({preview})`: validates a typed
  `nftables-intent-preview-1` candidate document, then optionally runs
  `nft --check --file <private-scratch-file>` only inside an existing
  **separate** Linux network namespace. No kernel rule changes and no
  `nft -f` without `--check`. The private temporary file is erased.
- `nftables_lab.rollback_trial({deadlineMs,advanceToMs,events})`: pure,
  deterministic **simulation** of state transitions and watchdog timeout.
  A simulated confirmation is NOT proof of successful production access.

A request cannot supply arbitrary executables or namespace names. The
operator must configure the environment of the local MAS process:

- `ADA_NFT_LAB_NAMESPACE`: explicitly selected existing laboratory netns
- `ADA_NFT_LAB_NFT`: approved absolute path to the nft executable
- `ADA_NFT_LAB_IP`: approved absolute path to the ip executable
- `ADA_NFT_LAB_NAMESPACE_ROOT`: approved absolute directory containing the
  kernel namespace handles that the selected iproute2 provider resolves
- `ADA_NFT_LAB_TEMP_ROOT` (optional): approved scratch directory; defaults
  to the OS temporary directory

The provider verifies `/proc/self/ns/net` and the configured
namespace-root plus selected namespace name have different device/inode identities
before executing an exact argument vector, without a shell:
`ip netns exec <name> nft --check --file <temporary-file>`.
Missing tool paths, namespace, or privilege returns `unavailable` or
`failed`; it never falls back to the default network namespace.
The namespace name is strictly validated. A random private 0700 directory
and 0600 script file are created after namespace verification. This is
necessary because nft rejects piped stdin as a non-regular file on
supported Linux runners. The scratch directory is removed in `finally`.
CLI output is not returned.
Kernel namespace identity could change between stat and exec; because
this provider uses `--check` exclusively and cannot apply rules, it is
not a production authorization or enforcement mechanism.

Only verified literal IPs, UDP/TCP ports and `accept` candidate verdicts
are used in generated syntax; arbitrary source labels are never inserted.
The generated table and chain have **no packet hook** and are check-only.

`syntaxVerified:true` means the checker reported success inside the
selected isolated namespace. It does **not** imply correct management
reachability, table/chain ownership, NAT policy or remote peer identity.

## Rollback rehearsal

The synthetic trial accepts stage events `syntax_validated`,
`arm_rollback`, `commit_simulated`, `management_probe_ok`,
`management_probe_failed`, `operator_confirmed` and an absolute
simulated deadline. It blocks out-of-order operations, rejects commits
after timeout and simulates a rollback when a committed configuration is
unconfirmed at the deadline. Outputs always say:

`simulated:true`, `kernelChanged:false`, `watchdogArmedLive:false`,
`confirmedInProduction:false`.

**A real privileged executor is not implemented.** That must be a separate
MAS provider that uses a pinned Mesh identity and per-node approval, owns
a dedicated table/chain, verifies a live base revision, arms an independent
out-of-band timer, performs atomic apply, obtains a fresh management probe,
and records a verified rollback or confirmation. Do not enable a
production apply operation on the strength of this simulation alone.

## Testing

`node tests/graph_nftables_lab.test.mjs`
`node tests/graph_nftables_rollback.test.mjs`

Unit tests use a mock executor and fake namespace stat, without root.
The `nftables-kernel-lab` GitHub Actions job also provisions a disposable
namespace on a temporary Linux runner, performs real `nft --check` for
IPv4 and IPv6, and compares the namespace ruleset before/after. This job also launches a detached CI-only watchdog worker, exits its
controller process, and verifies real deletion of an unhooked test table
without any surviving kernel rules. See
`tests/native/nftables_watchdog_real.test.mjs` and
`tests/native/nft_lab_watchdog_worker.mjs`.

These worker scripts are **test-only** and require a designated disposable
namespace and an explicit CI environment gate. They are **not installed
with the MAS plugin**, not proof of production out-of-band reachability,
and not a production rollback daemon.

The no-live-change boundary follows nftables' documented distinction
between atomic ruleset loads and check mode:
https://wiki.nftables.org/wiki-nftables/index.php/Atomic_rule_replacement
