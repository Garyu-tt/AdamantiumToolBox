import {strict as assert} from 'node:assert';
import {MockWorld, sensoryFromWorld, motorTowardTarget} from '../sdk/dante/mock_world.mjs';
const world = new MockWorld({start: -2, target: 3, limit: 100});
let w = world;
for (let i = 0; i < 100; i++) {
  const obs = w.observe();
  const event = sensoryFromWorld(obs);
  assert.equal(event.sequence, i);
  assert.equal(event.payload.position, obs.position);
  const command = motorTowardTarget(obs);
  const next = w.step(command);
  assert.equal(next.tick, i + 1);
  if (i === 42) w = MockWorld.restore(JSON.parse(JSON.stringify(w.snapshot())));
}
assert.equal(w.observe().position, 3);
assert.throws(() => w.step(motorTowardTarget(w.observe())), /tick_limit/);
assert.throws(() => new MockWorld({limit: Infinity}), /invalid_world_config/);
assert.throws(() => w.step({schema:'dante.motor.command.v1', tick: 100, delta: 5}), /invalid_motor_command/);
assert.throws(() => MockWorld.restore({...w.snapshot(), error: 42}), /invalid_world_snapshot/);
const before = w.snapshot();
assert.throws(() => w.step({schema:'dante.motor.command.v1',tick:99,delta:1}), /invalid_motor_command/);
assert.deepEqual(w.snapshot(), before);
console.log('DANTE_MOCK_WORLD_OK 100 ticks; restart at tick 43; bounded motor command');
