import {strict as assert} from 'node:assert';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ReliableSensoryBus} from '../sdk/dante/reliable_sensory.mjs';
const event = (sequence, source = 'cpu.world', payload = {distance: 2}) => ({
  schema: 'dante.sensory.event.v1', source, kind: 'visual.frame',
  sequence, observedAtMs: sequence + 1000, payload});
const bus = new ReliableSensoryBus({capacity: 2, maxBytes: 1024, maxSources: 2});
const original = event(0);
assert.deepEqual(bus.publish(original), {ok: true});
original.payload.distance = 9;
assert.deepEqual(bus.publish(event(1)), {ok: true});
const [first] = bus.claim();
assert.equal(first.event.payload.distance, 2);
first.event.payload.distance = 300;
assert.deepEqual(bus.publish(event(2)), {ok: false, reason: 'backpressure'});
assert.equal(bus.ack(123456), false);
assert.equal(bus.nack(first.receipt), true);
const retried = bus.claim();
assert.deepEqual(retried.map(x => x.event.sequence), [0]);
assert.equal(bus.ack(first.receipt), false); // stale attempt cannot ACK replay
assert.equal(bus.ack(retried[0].receipt), true);
assert.equal(bus.ack(first.receipt), false);
assert.deepEqual(bus.publish(event(2)), {ok: true});
assert.deepEqual(bus.publish(event(2)), {ok: false, reason: 'non_monotonic_sequence'});
const sourceBus = new ReliableSensoryBus({capacity: 3, maxSources: 1});
assert.deepEqual(sourceBus.publish(event(0, 'cpu.other')), {ok: true});
assert.deepEqual(sourceBus.publish(event(0, 'cpu.third')), {ok: false, reason: 'source_limit'});
const cyclic = {}; cyclic.self = cyclic;
assert.deepEqual(bus.publish(event(3, 'cpu.world', cyclic)), {ok: false, reason: 'invalid_payload'});
assert.deepEqual(bus.publish(event(3, 'cpu.world', {blob: 'x'.repeat(2000)})),
  {ok: false, reason: 'event_too_large'});
assert.deepEqual(bus.publish(event(3, 'cpu.world', {date: new Date()})),
  {ok: false, reason: 'invalid_payload'});
const getter = {}; Object.defineProperty(getter, 'value', {enumerable: true, get: () => 5});
assert.deepEqual(bus.publish(event(3, 'cpu.world', getter)),
  {ok: false, reason: 'invalid_payload'});
const evil = new Proxy({}, {ownKeys: () => {throw Error('boom');}});
assert.deepEqual(bus.publish(event(3, 'cpu.world', evil)),
  {ok: false, reason: 'invalid_payload'});
const extra = [2]; extra.foo = 'ignored by JSON';
assert.deepEqual(bus.publish(event(3, 'cpu.world', {extra})),
  {ok: false, reason: 'invalid_payload'});
const dir = await mkdtemp(join(tmpdir(), 'dante-gauntlet-'));
try {
  const path = join(dir, 'snapshot.json');
  const before = bus.snapshot();
  await writeFile(path, JSON.stringify(before));
  const recovered = ReliableSensoryBus.restore(JSON.parse(await readFile(path, 'utf8')));
  assert.equal(recovered.status().leased, 0);
  assert.equal(recovered.status().queued, 2);
  assert.equal(recovered.status().replayed, 0); // first receipt had been ACKed
  const seq = recovered.claim(2).map(x => x.event.sequence);
  assert.deepEqual(seq, [1, 2]);
  assert.deepEqual(recovered.publish(event(4)), {ok: false, reason: 'backpressure'});
  const wrong = structuredClone(before); wrong.last.push(['x', 3]);
  assert.throws(() => ReliableSensoryBus.restore(wrong), /invalid_snapshot/);
  const bad = structuredClone(before); bad.ready[0].event.payload = cyclic;
  assert.throws(() => ReliableSensoryBus.restore(bad), /invalid_snapshot/);
} finally { await rm(dir, {recursive: true, force: true}); }
const inflight = new ReliableSensoryBus();
inflight.publish(event(0)); inflight.publish(event(1));
const claimed = inflight.claim(1);
const restored = ReliableSensoryBus.restore(inflight.snapshot());
assert.deepEqual(restored.claim(2).map(x => x.event.sequence), [0, 1]);
assert.equal(restored.status().replayed, 1);
assert.equal(inflight.ack(claimed[0].receipt), true);
assert.throws(() => new ReliableSensoryBus({maxSources: Infinity}), /invalid_capacity/);
assert.throws(() => inflight.claim(-1), /invalid_limit/);
console.log('DANTE_RELIABLE_SENSORY_QA_OK');
const stress = new ReliableSensoryBus({capacity: 4, maxSources: 1});
for (let i = 0; i < 10000; i++) {
  assert.equal(stress.publish(event(i)).ok, true);
  const [lease] = stress.claim();
  assert.equal(stress.ack(lease.receipt), true);
}
assert.equal(stress.status().queued, 0);
assert.equal(stress.status().sources, 1);
assert.equal(stress.status().acked, 10000);
assert.throws(() => new ReliableSensoryBus({capacity: 4096, maxBytes: 1048576}),
  /invalid_memory_budget/);
