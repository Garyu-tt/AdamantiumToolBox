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
