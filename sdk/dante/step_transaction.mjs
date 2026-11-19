// DANTE-P0-04: pure deterministic CPU step transaction for isolated fixtures.
// Not an external-world exactly-once protocol; the caller owns all effects.
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
  // All callbacks MUST be deterministic and side-effect-free. Clone first to
  // prevent a failed write from mutating the previously committed state.
  const brain = structuredClone(previous.brain);
  const world = structuredClone(previous.world);
  const updatedBrain = await brainStep(brain, structuredClone(observation));
  const command = await motorStep(structuredClone(updatedBrain), structuredClone(observation));
  const updatedWorld = await worldStep(world, structuredClone(command));
  const next = {schema: STEP_SCHEMA, tick: previous.tick + 1,
    brain: updatedBrain, world: updatedWorld};
  if (!valid(next)) throw Error('invalid_step_result');
  const saved = await saveCheckpoint(path, next, options);
  // Return the command only after checkpoint fsync+rename has succeeded.
  // Never send this command to an external actuator without a separate
  // durable outbox and idempotent command receipt protocol.
  return {state: next, command, checkpoint: saved};
}
