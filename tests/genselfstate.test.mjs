import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createSnapshot,verifySnapshot,SCHEMA} from '../apps/genselfstate/codec.mjs';
const event0='a'.repeat(64), event1='b'.repeat(64);
const pieces=()=>[
 {slot:'perception',contract:'genesis.sensory.integrate.v1',state:{count:5,cursors:[{sequence:5}],flag:true}},
 {slot:'worldmodel',contract:'genesis.worldmodel.update.v1',state:{position:2,target:4}}
];
test('canonical snapshot, hash chain, immutable inputs and deterministic replay',()=>{
 const components=pieces();
 const one=createSnapshot({instanceId:'dante.test',components,lastEventId:event0});
 assert.equal(one.schema,SCHEMA);assert.equal(one.revision,0);
 assert.equal(one.parentDigest,null);assert.equal(one.lastEventId,event0);
 assert.equal(one.components[0].slot,'perception');
 assert.deepEqual(createSnapshot({instanceId:'dante.test',components:components.slice().reverse(),lastEventId:event0}),one);
 components[0].state.count=777;assert.equal(one.components[0].state.count,5);
 assert.deepEqual(verifySnapshot(JSON.parse(JSON.stringify(one))),one);
 const two=createSnapshot({instanceId:'dante.test',previous:one,components:pieces(),lastEventId:event1});
 assert.equal(two.revision,1);assert.equal(two.parentDigest,one.digest);
 assert.equal(two.lastEventId,event1);assert.equal(one.revision,0);
 assert.throws(()=>createSnapshot({instanceId:'dante.other',previous:one,components:pieces(),lastEventId:event1}),/instance_mismatch/);
 assert.throws(()=>createSnapshot({instanceId:'dante.test',previous:one,components:pieces(),lastEventId:event0}),/event_cursor_regression/);
 assert.throws(()=>createSnapshot({instanceId:'dante.test',previous:one,components:pieces(),lastEventId:null}),/event_cursor_regression/);
});
test('integrity and malformed state always fail closed',()=>{
 const one=createSnapshot({instanceId:'dante.test',components:pieces(),lastEventId:event0});
 assert.throws(()=>verifySnapshot({...one,revision:4}),/invalid_snapshot/);
 assert.throws(()=>verifySnapshot({...one,components:[{...one.components[0],state:{count:900}}]}),/snapshot_integrity_failed/);
 assert.throws(()=>verifySnapshot({...one,digest:'not-sha'}),/invalid_snapshot/);
 assert.throws(()=>createSnapshot({instanceId:'dante.test',components:[]}),/invalid_components/);
 assert.throws(()=>createSnapshot({instanceId:'dante.test',components:[pieces()[0],pieces()[0]]}),/invalid_component/);
 const cyclic={};cyclic.me=cyclic;
 assert.throws(()=>createSnapshot({instanceId:'dante.test',components:[{...pieces()[0],state:cyclic}]}),/state_depth_exceeded/);
 assert.throws(()=>createSnapshot({instanceId:'dante.test',components:[{...pieces()[0],state:{big:'x'.repeat(9000)}}]}),/invalid_state_value/);
 assert.throws(()=>createSnapshot({instanceId:'dante.test',components:[{...pieces()[0],state:JSON.parse('{"__proto__":1}')}]}),/unsafe_state_key/);
 assert.throws(()=>createSnapshot({instanceId:'dante.test',components:[{...pieces()[0],state:{f:Infinity}}]}),/invalid_state_value/);
});
test('100+ candidate revisions can be serialized and linked without a cognitive runtime',()=>{
 let last=null;
 for(let i=0;i<121;i++){
  const cursor=i.toString(16).padStart(64,'0');
  last=createSnapshot({instanceId:'dante.test',previous:last,lastEventId:cursor,components:pieces()});
  last=verifySnapshot(JSON.parse(JSON.stringify(last)));
 }
 assert.equal(last.revision,120);assert.equal(last.lastEventId,(120).toString(16).padStart(64,'0'));
 assert.equal(last.origin,'candidate');
});
