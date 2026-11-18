# R04 Edge storage policy and Noosphere laptop footprint

Status: experimental, not production memory storage. This release changes the independent Database plugin and its portable signed package, not the legacy Noospheres.

## Default policy (fail closed)

Unless a vetted deployment policy explicitly overrides it, Database starts with:
- `tier: edge`
- `maxJournalBytes: 16777216` (16 MiB, journal hard cap)
- `allowWrites: false` (storage graph write actions are not advertised)
- `maxBackups: 0` (no backup job is bundled or activated)

The upper limit accepted by the configuration validator is **one** backup. One is a *permission for a future opt-in backup engine*, not a claim that backup rotation is implemented. Even when configured as one, R04 currently creates no backup. A hard cap applies to the Database journal only, not the whole host or optional future datasets.

Example opt-in policy for synthetic tests only:
```json
{
  "schema": "mas-database-policy-1",
  "tier": "edge",
  "maxJournalBytes": 1048576,
  "maxBackups": 0,
  "allowWrites": true
}
```
Pass the JSON through the `DATABASE_STORAGE_POLICY` environment variable, not a hardcoded endpoint or filename. This sample does **not** imply the journal is safe for irreplaceable memories.

## Safety and ownership

- Noosphere itself stores no Database files or backups. Its installed R03 mode is stateless with zero retained objects.
- Database owns its data directory, writer lock and journal. At startup, it rejects a journal above configured quota.
- Each transaction is sized before append; a transaction that exceeds the cap fails without deliberate data eviction.
- A plugin can still have in-memory working state. Do not confuse journal size with full process RAM or total Windows disk use.
- Local data should remain disposable cache/metadata until trusted remote storage and verified independent backups exist. Never make a laptop the only copy.
- Do not run automatic garbage collection on any legacy data or delete old archives to meet these limits.
- Disk-space policy, failover, authenticated remote nodes, encryption, per-caller ACL and backup restore drills remain separate hard requirements.

## Verification

- `node tests/database-edge.test.mjs`: default fail-closed behavior, invalid backup settings, byte quota and reopening over quota.
- `node tests/database-package.test.mjs`: relocatable signed-compatible package, no write action, status and backup count.
- `node tests/database-http.test.mjs`: explicitly opt-in synthetic writes in disposable test directory.

## Deployment gate

Do not activate a new Database package in the user's runtime without checking the signed package hash, local owner policy, a successful lifecycle probe and health/graph readback. If JediControl or Windows command execution times out, read back state instead of blind mutation retry.

## R04.1 read-only repair and real Windows deployment

The first laptop activation (0.1.0) passed the lifecycle probe but its storage module reported `writer_locked`. The old probe created a zero-byte journal and lock in the default runtime directory, then Windows process termination did not execute storage cleanup. No memory was written.

R04.1 (0.1.1) fixes this by never opening a writer lock or creating a journal when `allowWrites=false`. It also changes the generic lifecycle probe to pass `ADA_PROBE_DATA_DIR`, an isolated throwaway directory, and clean it afterward. The standalone Database service honors this temporary location.

The signed **local Edge variant** uses a port selected from currently free ports at installation, not a hardcoded cross-plugin port: port 9000 on the owner's Windows laptop. Its manifest grants `database.read` only. Version 0.1.1 was selected via Toolbox Lifecycle with hash `6725c612bf88fb2b88b3bb417c3e13f99484c08a6b40e95927ce9bee05469d42` and the probe passed.

Live readback confirmed `storage.journal` and `indexing.subjects` active; Core graph shows `database.query/history/status/subjects` but **no write action**. `database.status` reports 0 bytes used, maxJournalBytes=16777216, allowWrites=false, backupCopies=0, maxBackupCopies=0. Leonardo and Noosphere remain live on their existing ports. Two old zero-byte files from the first probe remain; no original user data was removed.

This is a **disposable read-only Edge runtime**, not Noosphere 3.0 distributed storage or a production backup mechanism. The Noosphere service remains stateless. No legacy memory is moved.
