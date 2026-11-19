import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {normalizeSensor} from '../apps/genormalize/codec.mjs';
const event={schema:'dante.sensory.event.v1',source:'world.mock',kind:'position',sequence:5,observedAtMs:5,
 payload:{position:1,target:3,nested:{b:2,a:1}}};
test('deterministic CPU normalization, stable canonical payload digest',()=>{
 const a=normalizeSensor(event);
 const b=normalizeSensor({...event,payload:{nested:{a:1,b:2},target:3,position:1}});
 assert.deepEqual(a,b);assert.deepEqual(a.signals,{position:1,target:3});
 assert.equal(a.unit,'raw');assert.equal(a.schema,'genesis.sensory.normalized.v1');
 assert.match(a.payloadSha256,/^[a-f0-9]{64}$/);
});
test('fails closed for invalid, oversized, cyclic, nonfinite inputs',()=>{
 assert.throws(()=>normalizeSensor({...event,sequence:-1}),/invalid_event/);
 assert.throws(()=>normalizeSensor({...event,payload:{value:Infinity}}),/invalid_value/);
 assert.throws(()=>normalizeSensor({...event,payload:{long:'x'.repeat(9000)}}),/invalid_value/);
 const cyclic={};cyclic.self=cyclic;
 assert.throws(()=>normalizeSensor({...event,payload:cyclic}),/max_depth/);
 assert.throws(()=>normalizeSensor({...event,payload:JSON.parse('{"__proto__":123}')}),/unsafe_key/);
});
