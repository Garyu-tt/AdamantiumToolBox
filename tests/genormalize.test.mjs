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
 assert.throws(()=>normalizeSensor({...event,payload:cyclic}),/cyclic_value|max_depth/);
 assert.throws(()=>normalizeSensor({...event,payload:JSON.parse('{"__proto__":123}')}),/unsafe_key/);
});

test('rejects accessor, sparse arrays and invalid scalar signal names without side effects',()=>{
 let calls=0;
 const payload={};
 Object.defineProperty(payload,'x',{enumerable:true,get(){calls++;return 1;}});
 assert.throws(()=>normalizeSensor({...event,payload}),/invalid_value/);
 assert.equal(calls,0);
 const top={...event};
 Object.defineProperty(top,'payload',{enumerable:true,get(){calls++;return {x:1};}});
 assert.throws(()=>normalizeSensor(top),/invalid_value/);
 assert.equal(calls,0);
 const sparse=new Array(2);sparse[1]=4;
 assert.throws(()=>normalizeSensor({...event,payload:{array:sparse}}),/invalid_value/);
 assert.throws(()=>normalizeSensor({...event,payload:{'':1}}),/invalid_signal_name/);
 assert.throws(()=>normalizeSensor({...event,payload:{'1bad':1}}),/invalid_signal_name/);
 assert.equal(normalizeSensor({...event,payload:{nested:{'':2}}}).signals[''],undefined);
});
