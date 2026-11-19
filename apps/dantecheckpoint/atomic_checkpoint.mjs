// Optional CPU-only Genesis state checkpoint contract; storage is caller-owned.
import {open, readFile, rename, unlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
export const CHECKPOINT_SCHEMA = 'dante.genesis.checkpoint.v1';
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = reason => { throw new Error(reason); };
const valid = value => value && typeof value === 'object' && !Array.isArray(value);
function jsonSafe(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) return false;
  seen.add(value);
  const ok = Object.keys(value).every(key => jsonSafe(value[key], seen)) &&
    (!Array.isArray(value) || Array.from({length: value.length}, (_, i) => i).every(i => i in value));
  seen.delete(value);
  return ok;
}
function serialize(state, maxBytes) {
  if (!valid(state) || !jsonSafe(state)) fail('invalid_state');
  let payload;
  try { payload = JSON.stringify(state); } catch { fail('unserializable_state'); }
  if (typeof payload !== 'string') fail('unserializable_state');
  const bytes = Buffer.byteLength(payload);
  if (bytes > maxBytes) fail('state_too_large');
  return payload;
}
export async function saveCheckpoint(path, state, {maxBytes = 1048576} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) fail('invalid_limit');
  const payload = serialize(state, maxBytes);
  const record = JSON.stringify({schema: CHECKPOINT_SCHEMA, bytes: Buffer.byteLength(payload),
    sha256: digest(payload), payload});
  const temp = join(dirname(path), `.dante-checkpoint-${randomUUID()}.tmp`);
  let file;
  try {
    file = await open(temp, 'wx', 0o600);
    await file.writeFile(record, 'utf8');
    await file.sync();
    await file.close(); file = undefined;
    await rename(temp, path);
    // Best effort directory durability on platforms supporting directory fsync.
    let directory;
    try { directory = await open(dirname(path), 'r'); await directory.sync(); }
    catch (e) { if (!['EINVAL','EISDIR','EPERM','EACCES','ENOTSUP'].includes(e.code)) throw e; }
    finally { await directory?.close(); }
    return {schema: CHECKPOINT_SCHEMA, sha256: digest(payload), bytes: Buffer.byteLength(payload)};
  } finally {
    await file?.close();
    await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; });
  }
}
export async function loadCheckpoint(path, {maxBytes = 1048576} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) fail('invalid_limit');
  const raw = await readFile(path);
  if (raw.byteLength > maxBytes * 2 + 512) fail('checkpoint_too_large');
  let record;
  try { record = JSON.parse(raw.toString('utf8')); } catch { fail('checkpoint_corrupt'); }
  if (!valid(record) || record.schema !== CHECKPOINT_SCHEMA) fail('unsupported_checkpoint_schema');
  if (typeof record.payload !== 'string' || !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0 || record.bytes > maxBytes ||
      Buffer.byteLength(record.payload) !== record.bytes ||
      !/^[a-f0-9]{64}$/.test(record.sha256 || '') || digest(record.payload) !== record.sha256)
    fail('checkpoint_integrity_failed');
  let state;
  try { state = JSON.parse(record.payload); } catch { fail('checkpoint_integrity_failed'); }
  if (!valid(state)) fail('checkpoint_integrity_failed');
  return {state, sha256: record.sha256, bytes: record.bytes, schema: record.schema};
}
