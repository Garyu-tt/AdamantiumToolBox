import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {updateWorldModel} from '../apps/genworldmodel/reducer.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const observation = (signals, payloadSha256) => ({
  schema: 'genesis.sensory.normalized.v1',
  source: 'world.mock', kind: 'position', sequence: 7, observedAtMs: 1234,
  traceId: null, unit: 'raw', signals, payloadSha256
});

test('SECURITY REPRO: forged same hash hides changed observation on replay', () => {
  const trusted = {position: 1, target: 5};
  const forged = {position: 999, target: 5};
  const claimed = hash(trusted);
  assert.notEqual(hash(forged), claimed, 'fixture must have distinct canonical payloads');
  const first = updateWorldModel({observation: observation(trusted, claimed)});
  const replay = updateWorldModel({
    model: first.model, observation: observation(forged, claimed)
  });
  // Current behavior is recorded, NOT accepted: caller-controlled payloadSha256
  // lets changed observations masquerade as duplicates.
  assert.equal(replay.status, 'duplicate');
  assert.deepEqual(replay.model, first.model);
  assert.equal(replay.model.entities[0].features.position, 1);
});

test('SECURITY CONTROL: changed hash with same sequence is rejected', () => {
  const a = {position: 1, target: 5};
  const b = {position: 999, target: 5};
  const first = updateWorldModel({observation: observation(a, hash(a))});
  assert.throws(
    () => updateWorldModel({model: first.model, observation: observation(b, hash(b))}),
    /sequence_conflict/
  );
});
