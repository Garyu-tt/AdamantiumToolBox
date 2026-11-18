import {strict as assert} from 'node:assert';
import {SensoryBus, SENSORY_SCHEMA, validateSensoryEvent} from '../sdk/dante/sensory_bus.mjs';
const sample = (sequence, kind = 'visual.frame') => ({schema: SENSORY_SCHEMA,
  source: 'cpu.world', kind, sequence, observedAtMs: 1000 + sequence,
  payload: {entity: 'cube', distance: 2}});
assert(validateSensoryEvent(sample(0)));
assert(!validateSensoryEvent({...sample(0), payload: null}));
const bus = new SensoryBus({capacity: 2});
const e0 = sample(0);
assert.deepEqual(bus.publish(e0), {ok: true});
e0.payload.distance = 99;
assert.deepEqual(bus.publish(sample(0)), {ok: false, reason: 'non_monotonic_sequence'});
assert.deepEqual(bus.publish(sample(1)), {ok: true});
assert.deepEqual(bus.publish(sample(2)), {ok: false, reason: 'backpressure'});
assert.deepEqual(bus.drain(1).map(e => e.payload.distance), [2]);
assert.deepEqual(bus.publish(sample(2)), {ok: true});
assert.deepEqual(bus.drain().map(e => e.sequence), [1, 2]);
assert.deepEqual(bus.status(), {schema: SENSORY_SCHEMA, queued: 0, capacity: 2,
  overflow: 'reject', accepted: 3, rejected: 2, dropped: 0, delivered: 3});
const lossy = new SensoryBus({capacity: 1, overflow: 'drop-oldest'});
lossy.publish(sample(0)); lossy.publish(sample(1));
assert.equal(lossy.status().dropped, 1);
assert.deepEqual(lossy.drain().map(e => e.sequence), [1]);
assert.deepEqual(lossy.publish({...sample(3), payload: {bad: () => 1}}),
  {ok: false, reason: 'uncloneable_payload'});
assert.throws(() => new SensoryBus({capacity: 0}), /invalid_capacity/);
assert.throws(() => lossy.drain(-1), /invalid_limit/);
console.log('DANTE_SENSORY_BUS_CONTRACT_OK');
