# nftables Lab R01 — isolated, non-applying syntax check

Status: **source prototype only**. Not deployed on VM 121, VM 122 or any
other host. No firewall rule or network namespace has been created or changed.

## Capabilities

This is an **independent** MAS app: it boots as Core + nftables_lab only,
without Graph DNS, Graph Firewall, Noosphere, WireGuard or nftables Preview.

- `nftables_lab.check({preview})`: validates a typed
  `nftables-intent-preview-1` candidate document, then optionally runs
  `nft --check --file -` only inside an existing **separate** Linux network
  namespace. No mutations, no file writes, no `nft -f` without `--check`.
- `nftables_lab.rollback_trial({deadlineMs,advanceToMs,events})`: pure,
  deterministic **simulation** of state transitions and watchdog timeout.
  A simulated confirmation is NOT proof of successful production access.

A request cannot supply arbitrary executables or namespace names. The
operator must configure the environment of the local MAS process:

- `ADA_NFT_LAB_NAMESPACE`: explicitly selected existing laboratory netns
- `ADA_NFT_LAB_NFT`: approved absolute path to the nft executable
- `ADA_NFT_LAB_IP`: approved absolute path to the ip executable

The provider verifies `/proc/self/ns/net` and
`/var/run/netns/<configured-name>` have different device/inode identities
before executing an exact argument vector, without a shell:
`ip netns exec <name> nft --check --file -`.
Missing tool paths, namespace, or privilege returns `unavailable` or
`failed`; it never falls back to the default network namespace.
The namespace name is strictly validated. CLI output is not returned.
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

Tests use a mock executor and fake namespace stat. They exercise the
safety contract without requiring root, nft, WireGuard or the host netns.

The no-live-change boundary follows nftables' documented distinction
between atomic ruleset loads and check mode:
https://wiki.nftables.org/wiki-nftables/index.php/Atomic_rule_replacement
