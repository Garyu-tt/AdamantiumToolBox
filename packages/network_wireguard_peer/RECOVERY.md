# Signed WireGuard peer recovery (source-only)

This module extends the independent \`network_wireguard_peer\` MAS app but **does not** replace \`network_wireguard\` introspection, \`network_approval\`, \`network_reconciler\`, or a host firewall.

## What is persisted

Opt-in \`NETWORK_WG_MANAGED_LEDGER\` records only verified peer changes; each entry has a version, sequence, previous SHA256 hash, timestamp, exact signed plan, **two public Ed25519 signatures**, and entry hash. Peer private keys and preshared keys are never stored. Host-owned parent directory must already exist, must not be group/world-writable, ledger mode must be 0600, symlinks are rejected, and every append is fsynced.

If an enrollment is not verified, no desired-state event is appended. A failed append following a successful live \`wg set\` returns \`verified:false\` and must be reconciled manually; there is **no automatic unsafe retry**. Unmanaged peer removal is refused. The ledger replays and verifies every historical signature and chain link. A local hash chain cannot detect whole-file deletion/truncation or privileged rollback: an independent signed Witness/Anchor is still required.

## Operator-only recovery

The bundled \`tools/restore.mjs\` is standalone and **not** exposed as a ChatGPT remote capability. It uses only an already-configured WireGuard interface, never calls \`wg-quick\` or modifies firewall, routing, system configs or private keys. It only re-adds missing, previously signed and verified \`/32\` peers. Existing unknown peers are left unchanged.

Required operator environment on the intended host:

- \`NETWORK_WG_IFACE\`: approved interface name
- \`NETWORK_WG_POOL\`: already allocated subnet matching the signed approvals
- \`NETWORK_WG_SERVER_IP\`: server's actual address inside the tunnel, always excluded
- \`NETWORK_WG_MANAGED_LEDGER\`: absolute path to local verified signed ledger (missing/corrupt = fail closed)
- \`NETWORK_WG_JOURNAL\`: absolute path to existing protected transaction journal (same lock shared with live peer updates)
- \`NETWORK_WG_SIGNERS_FILE\`: pinned distinct Ed25519 public verification keys in JSON
- \`NETWORK_WG_BIN\`: optional trusted binary path; otherwise \`wg\`

\`node packages/network_wireguard_peer/tools/restore.mjs --preview\` shows the number of missing and matching peers with state digests, without keys or endpoints.

\`--apply\` additionally requires \`NETWORK_WG_RESTORE_ENABLED=1\` and an authorized OS principal with **only** the needed permission to invoke \`wg set\` on the approved interface. It obtains the same exclusive lock as enrollment, checks a fresh live snapshot for unknown overlapping routes, writes an auditable attempt before mutation and verifies each changed peer. If the command times out or fails after the attempt, the journal blocks subsequent automatic recovery until an operator investigates. A previous **verified** run may recover peers again after interface reset or server reboot.

No systemd unit is enabled or installed by this PR. For opt-in startup automation, bind the existing interface's startup dependency and restricted service privileges explicitly, and test emergency rollback on the target host. The recovery script does not create a WireGuard interface, firewall rule, network route, Android VM TUN, or VPN client profile.

## Verification

\`node --test packages/network_wireguard_peer/tests/*.test.mjs\` covers signed ledger reload and corruption, duplicate/replayed changes, state conflicts and an end-to-end mocked boot/reboot cycle. Source CI is **not** proof of installed VPN or active handshake.
