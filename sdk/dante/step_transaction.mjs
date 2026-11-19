// DANTE-P0-04: pure deterministic CPU step transaction for isolated fixtures.
// Cross-process fail-closed writer lock; no stale-lock takeover or external motor exactly-once.
import {open, unlink} from 'node:fs/promises';
import {saveCheckpoint, loadCheckpoint} from './checkpoint.mjs';
export const STEP_SCHEMA = 'dante.step.v1';
const valid = s => s && s.schema === STEP_SCHEMA &&
  Number.isSafeInteger(s.tick) && s.tick >= 0 &&
  s.brain && typeof s.brain === 'object' && !Array.isArray(s.brain) &&
  s.world && typeof s.world === 'object' && !Array.isArray(s.world);
export async function restoreStep(path, options) {
  const {state, sha256} = await loadCheckpoint(path, options);
  if (!valid(state)) throw Error('invalid_step_checkpoint');
  return {state, sha256};
}
export async function commitStep(path, previous, observation, {
  brainStep, motorStep, worldStep, options = {}
} = {}) {
  if (!valid(previous) || typeof brainStep !== 'function' ||
      typeof motorStep !== 'function' || typeof worldStep !== 'function')
    throw Error('invalid_step_contract');
  if (previous.tick >= Number.MAX_SAFE_INTEGER) throw Error('tick_overflow');
  // O_EXCL is atomic for local filesystems; lock persists on process crash,
  // deliberately requiring manual recovery rather than unsafe auto-steal.
  const lockPath = `${path}.writer.lock`;
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (e) {
    if (e.code === 'EEXIST') throw Error('step_writer_locked');
    throw e;
  }
  try {
    // Keep lock throughout callbacks and checkpoint rename; prevent a stale
    // caller from overwriting a later brain/world state.
    const current = await restoreStep(path);
    if (current.state.tick !== previous.tick ||
        JSON.stringify(current.state) !== JSON.stringify(previous))
      throw Error('stale_step_checkpoint');
    const brain = structuredClone(previous.brain);
    const world = structuredClone(previous.world);
    const updatedBrain = await brainStep(brain, structuredClone(observation));
    const command = await motorStep(structuredClone(updatedBrain), structuredClone(observation));
    const updatedWorld = await worldStep(world, structuredClone(command));
    const next = {schema: STEP_SCHEMA, tick: previous.tick + 1,
      brain: updatedBrain, world: updatedWorld};
    if (!valid(next)) throw Error('invalid_step_result');
    const saved = await saveCheckpoint(path, next, options);
    return {state: next, command, checkpoint: saved};
  } finally {
    // If lock cleanup fails, preserve fail-closed state and surface error.
    try { await lock.close(); } finally { await unlink(lockPath); }
  }
}
