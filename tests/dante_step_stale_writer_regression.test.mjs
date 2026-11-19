import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {saveCheckpoint} from '../sdk/dante/checkpoint.mjs';
import {commitStep, restoreStep, STEP_SCHEMA} from '../sdk/dante/step_transaction.mjs';

const initial = () => ({schema: STEP_SCHEMA, tick: 0,
  brain: {ticks: 0}, world: {position: 0}});
const steps = delta => ({
  brainStep: b => ({ticks: b.ticks + 1}),
  motorStep: () => ({delta}),
  worldStep: (w, cmd) => ({position: w.position + cmd.delta})
});

test('P0: stale caller must not replace newer durable brain/world tick', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dante-step-stale-'));
  const path = join(dir, 'state.json');
  try {
    const old = initial();
    await saveCheckpoint(path, old);
    const winner = await commitStep(path, old, {}, steps(1));
    assert.equal((await restoreStep(path)).state.world.position, 1);
    // RED against #87: stale caller uses old tick=0 and currently overwrites tick=1.
    await assert.rejects(
      commitStep(path, old, {}, steps(-1)),
      /stale|conflict|owner|lease|fenc|version|lock/i
    );
    assert.deepEqual((await restoreStep(path)).state, winner.state);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('P0: competing writers must not both acknowledge the same prior tick', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dante-step-two-writers-'));
  const path = join(dir, 'state.json');
  try {
    const old = initial();
    await saveCheckpoint(path, old);
    const results = await Promise.allSettled([
      commitStep(path, old, {}, steps(1)),
      commitStep(path, old, {}, steps(-1))
    ]);
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1,
      'only one commit from a shared prior tick may be acknowledged');
    const persisted = (await restoreStep(path)).state;
    assert.equal(persisted.tick, 1);
    assert.equal(persisted.world.position,
      results.find(x => x.status === 'fulfilled').value.state.world.position);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
