import {strict as assert} from 'node:assert';
import {mkdtemp, rm, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {commitStep, restoreStep, STEP_SCHEMA} from '../sdk/dante/step_transaction.mjs';
import {saveCheckpoint} from '../sdk/dante/checkpoint.mjs';
const dir = await mkdtemp(join(tmpdir(), 'dante-step-'));
const path = join(dir, 'state.json');
const initial = {schema: STEP_SCHEMA, tick: 0,
  brain: {ticks: 0, weight: 0.2}, world: {position: 0, target: 4}};
const step = {
  brainStep: b => { b.ticks++; b.weight += 0.01; return b; },
  motorStep: (_brain, obs) => ({delta: Math.sign(obs.target - obs.position)}),
  worldStep: (w, cmd) => { w.position += cmd.delta; return w; }
};
try {
  await saveCheckpoint(path, initial);
  let state = initial;
  for (let i = 0; i < 3; i++) {
    const result = await commitStep(path, state, structuredClone(state.world), step);
    assert.equal(result.state.tick, i + 1);
    state = (await restoreStep(path)).state; // real disk readback per tick
    assert.deepEqual(state, result.state);
  }
  assert.equal(state.world.position, 3);
  assert.equal(state.brain.ticks, 3);
  assert.equal(initial.world.position, 0);
  assert.equal(initial.brain.weight, 0.2);
  const before = await readFile(path);
  await assert.rejects(commitStep(path, state, state.world, {
    ...step, worldStep: () => { throw Error('injected_crash'); }
  }), /injected_crash/);
  assert.deepEqual(await readFile(path), before);
  await assert.rejects(commitStep(path, state, state.world, {
    ...step, brainStep: () => ({bad: Infinity})
  }), /invalid_state/);
  assert.deepEqual(await readFile(path), before);
  await assert.rejects(commitStep(path, state, state.world, {
    ...step, worldStep: w => w, options: {maxBytes: 8}
  }), /state_too_large/);
  assert.deepEqual(await readFile(path), before);
  const corrupted = Buffer.from(before);
  corrupted[corrupted.length - 3] ^= 1;
  await writeFile(path, corrupted);
  await assert.rejects(restoreStep(path), /checkpoint_(integrity_failed|corrupt)/);
  await writeFile(path, before);
  assert.deepEqual((await restoreStep(path)).state, state);
  console.log('DANTE_P0_STEP_TRANSACTION_QA_OK');
} finally {
  await rm(dir, {recursive: true, force: true});
}
