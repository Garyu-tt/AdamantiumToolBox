# Rollback Watchdog R01 — independent evidence verifier

**Status:** standalone, read-only MAS source prototype; not a production watchdog,
not installed on VM121/VM122. No new process, timer, firewall apply or kernel
rollback is armed by this plugin.

## Core + one plugin

The `rollback_watchdog` app boots with minimum Core and only
`rollback_watchdog.read`. Its dynamic graph exports two read-only actions:

- `rollback_watchdog.receipt({receipt, expectedLeaseId,
  expectedTargetNode,expectedPlanDigest,expectedBaseRevision})`
- `rollback_watchdog.journal({schema,leaseId,planDigest,
  deadlineSeconds,events})`
- `rollback_watchdog.diagnose({transaction,receipt?,journal?,
  expectedLeaseId?,expectedTargetNode?,expectedBaseRevision?})`
  builds eight blocked stage nodes plus one diagnostic node per stage,
  with explicit causes, impact, proposed remedies and prerequisite edges.
  It verifies any supplied receipt/journal locally rather than trusting a
  caller-provided success flag; it cannot attest a live node or apply rules.

Other apps (nftables Preview, nftables Lab) link to these capabilities only
when available and authorized, with no mandatory import or runtime dependency.

## Operator authorization: pinned key, but no commit authority

Ed25519 verification uses **only** an operator-managed pinned public key
provided by `ADA_ROLLBACK_TRUST_SPKI` (base64 DER SPKI). The client cannot
supply or replace the trust anchor. The canonical approval payload binds
exactly the lease ID, target node, plan digest, base kernel revision and
issued/expiry seconds. TTL is bounded. Missing trust root, modified payload,
bad signature, outdated time and wrong target all fail closed.

A valid signature alone does NOT verify the remote node identity, prove that
the ruleset still has the signed revision, prevent a replay, authorize
privileged commands, or show that the watchdog is independently alive.
Consequently all checks return `readyToArm:false`,
`readyToApply:false` and `productionWatchdogArmed:false`.

## Journal graph: distinguish claims from verified evidence

The journal is a bounded deterministic hash chain with sequential event IDs,
monotonic timestamps and transition checks:

```text
draft → armed → staged → observed → confirmed
                  ↘ rollback_pending → rolled_back
```

It diagnoses missing or late confirmation, rollback overdue, invalid event
order, changed hashes and replayed sequence numbers. Nodes become
diagnostic graph entries. A consistent hash chain is not authenticated:
anyone able to rewrite the entire unsealed journal can recompute all hashes.
The check therefore reports `chainConsistent` separately from
`journalIntegrityVerified:false` and `writerAuthenticated:false`.

Even `rollback_verified` in this caller-supplied log is only a **claim**:
`rollbackClaimed:true`, `rollbackCompleted:false`,
`kernelReadbackVerified:false`. A real receipt must come from an
authenticated trusted node after rereading actual kernel state.

## Optional independent evidence providers

- `rollback_ledger` reserves Ed25519-signed lease IDs once per private
  local store and can recover pending/expired entries after restart.
  Its `audit` is an untrusted local observation; it does not prove
  global replay protection, writer attestation or completed recovery.
- `nftables_readback` reads a configured separate namespace using only
  `nft -j list ruleset` and returns a best-effort kernel JSON digest.
  Caller-supplied readback may flag a digest mismatch but cannot
  attest a particular target-node identity.

The `rollback_watchdog.diagnose` API accepts these optional snapshots
and always keeps its eight transaction gates blocked. It does not
invoke or require either plugin. Separate MAS manifest links are
visible only when the provider exists and the caller has permission.

## Minimum separate privileged watchdog requirements

Before enabling any production write capability in a **different plugin**:

1. Bind a unique lease nonce and plan digest to a pinned target identity;
   use durable replay protection and a monotonic deadline.
2. Seal all journal transitions with an authenticated writer and persist
   an fsync-safe transaction record on independent storage.
3. Verify a kernel ruleset precondition and ownership of only dedicated
   tables/chains; reject unknown external changes.
4. Start an autonomous watchdog outside the network being modified and
   obtain a signed, fresh `armed` acknowledgment **before** applying.
5. Apply atomically, reread the kernel revision and independently probe
   the management path over a different transport.
6. Confirm by lease-bound signature before deadline; otherwise automatically
   roll back from independent state and verify the final kernel digest.
7. Surface unverified and overdue leases as graph blockers, never silently
   mark them complete or loop forever.

The existing GitHub disposable-netns lab only proves that a test-only
unhooked nftables table can be reverted by an independent process after
its controller exits. It is **not** a durable production watchdog.

## Tests

`node tests/graph_watchdog_receipt.test.mjs`
`node tests/graph_watchdog_journal.test.mjs`

No file writes, kernel access, subprocess, network I/O or stored keys are
required for either pure verifier.
