# Rollback Ledger R01 — local one-use lease reservations

**Status:** independently installable MAS source module, not deployed to
any VM. Does NOT run a watchdog, apply firewall rules or move network routes.

## Core + only this app

The `rollback_ledger` plugin declares separate scoped capabilities:
- `rollback_ledger.read` exposes `inspect({leaseId})` and `audit({})`.
- `rollback_ledger.reserve` exposes `reserve({receipt,context})`.

A client with read permission **cannot reserve**. Core's graph includes
only actions allowed by the current capability set. No imports of
Rollback Watchdog, nftables, Noosphere, or other app implementations.
Optional graph links appear only if their providers are available.

## Durable one-use reservation

An operator must pre-provision a **private 0700 directory** and configure
`ADA_ROLLBACK_LEDGER_DIR`, plus a pinned Ed25519 public key at
`ADA_ROLLBACK_TRUST_SPKI` (base64 DER SPKI). No default storage path or
embedded credential. The server uses its own wall clock, not a caller's.

The reservation validates a 10-minute-maximum signed approval (same
canonical receipt contract as Rollback Watchdog), binds the exact
leaseId, node, plan digest, base ruleset revision and expiration, and
creates `<root>/SHA256(leaseId)` using exclusive directory creation.
It persists the original signature with `claim.json` via exclusive 0600 creation, flushes the file
and both relevant directory entries with `fsync`, and **never deletes**
a consumed lease. Another process cannot claim the same lease ID through
the same filesystem store. A timeout, failed fsync or crash that leaves
a partial directory consumes the lease conservatively: the entry becomes
an **indeterminate tombstone**, not a reusable permit.

Every read independently re-verifies the persisted Ed25519 signature using
only the pinned operator trust root, including the original target node,
plan digest, base revision and issuance/expiry. It refuses symlinked record
files, wrong ownership and non-private permissions. A missing trust root,
modified signed field, missing signature, unreadable record or partial
write is **indeterminate**, never a confirmed reservation.

`audit({})` scans a bounded number of lease entries, identifies
unreadable/partial records and expired reservations, and marks all
recovered claims as needing independent status verification. The scan
survives application restarts because the state lives in the
operator-provisioned directory.

## Hard limits and non-guarantees

- This is a **single-store** replay gate, not distributed/global replay
  prevention. Two disconnected replicas with different directories
  could each accept the same signed lease. Multi-node operation requires
  a consensus-backed unique claim authority.
- The persisted signature authenticates the **signed approval**, not the
  ledger writer or the file's creation time. An attacker able to delete
  or replace the entire store can still re-enable lease reuse. Storage
  needs an independent monotonic checkpoint/append-only authority.
- Readable on-disk metadata is **not an authenticated audit journal**;
  offline administrators, root or a compromised host can rewrite it.
  A private directory and SHA-256 filenames are not cryptographic
  tamper evidence. A separate sealed, replicated event log is required.
- `status:'reserved'` proves only local reservation at inspection
  time; it does not prove independent watchdog liveness, target-node
  attestation, firewall application, rollback completion or network
  reachability.
- A signed receipt plus a durable reservation **never** returns
  `readyToApply:true`, `watchdogArmed:true` or an execute permission.
- `inspect` and `audit` are restricted network-inventory endpoints:
  never expose them publicly. This demo uses the Core-delegated MAS
  internal key on loopback.
- Root storage must support directory-exclusivity and reliable fsync.
  For production, verify local filesystem semantics and backup/restore
  rules; restoring an older snapshot must never reopen used leases.

## Test coverage

`node tests/graph_rollback_ledger.test.mjs` checks pinned signature,
concurrent claims, duplicate reservation, partial tombstone, expired
status, unsafe permissions, and audit after a process-style restart.

`node tests/graph_ledger_http.test.mjs` starts/stops the standalone
service, verifies read/write capability separation, then verifies that
a lease cannot be re-reserved after the service restarts.

`node tests/graph_ledger_integrity.test.mjs` mutates the saved record,
removes its trust root, changes file permissions and tests symlink rejection.

Future executor and autonomous watchdog remain separate providers and
must bind against a truly authoritative replay store before production.
