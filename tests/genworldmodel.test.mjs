import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {emptyModel,validateModel,eventId} from '../apps/genworldmodel/schema.mjs';
import {updateWorldModel} from '../apps/genworldmodel/reducer.mjs';
const event=(n,value=n,source='world.mock',time=n)=>({
 schema:'genesis.sensory.normalized.v1',source,kind:'position',sequence:n,observedAtMs:time,
 traceId:null,unit:'raw',signals:{position:value,target:5},
 payloadSha256:createHash('sha256').update(JSON.stringify({position:value,target:5})).digest('hex')});
test('world representation is immutable and tracks numeric features and change',()=>{
 const original=emptyModel(),a=updateWorldModel({model:original,observation:event(0,1,undefined,100)});
 assert.equal(original.entities.length,0);
 assert.equal(a.model.revision,1);
 assert.equal(a.changes.find(x=>x.feature==='position').delta,null);
 const next=updateWorldModel({model:a.model,observation:event(1,3,undefined,200)});
 const pos=next.changes.find(x=>x.feature==='position');
 assert.equal(pos.previous,1);assert.equal(pos.value,3);assert.equal(pos.delta,2);
 assert.equal(pos.ratePerMs,0.02);
 assert.equal(next.model.entities[0].samples,2);
 assert.equal(next.model.entities[0].features.position,3);
 assert.equal(a.model.entities[0].features.position,1);
 assert.equal(next.eventId,eventId(event(1,3,undefined,200)));
 validateModel(next.model);
});
test('deduplicates identical events and refuses gaps or conflicts',()=>{
 const a=updateWorldModel({observation:event(3,1)});
 const replay=updateWorldModel({model:a.model,observation:event(3,1)});
 assert.equal(replay.status,'duplicate');assert.equal(replay.model.revision,1);
 assert.notStrictEqual(replay.model,a.model);
 assert.throws(()=>updateWorldModel({model:a.model,observation:event(2,1)}),/sequence_regression/);
 assert.throws(()=>updateWorldModel({model:a.model,observation:event(5,4)}),/sequence_gap/);
 assert.throws(()=>updateWorldModel({model:a.model,observation:event(3,4)}),/sequence_conflict/);
 assert.throws(()=>updateWorldModel({model:a.model,observation:event(4,4,undefined,2)}),/time_regression/);
});
test('multi-source state, bounded entities, and malicious state fail closed',()=>{
 let model=emptyModel();
 model=updateWorldModel({model,observation:event(0,1,'source.one'),maxEntities:2}).model;
 model=updateWorldModel({model,observation:event(0,2,'source.two'),maxEntities:2}).model;
 assert.equal(model.entities.length,2);assert.equal(model.revision,2);
 assert.deepEqual(model.entities.map(x=>x.source),['source.one','source.two']);
 assert.throws(()=>updateWorldModel({model,observation:event(0,3,'source.three'),maxEntities:2}),/entity_limit/);
 assert.throws(()=>updateWorldModel({model:{...model,revision:0},observation:event(1,2,'source.one'),maxEntities:2}),/invalid_worldmodel_state/);
 assert.throws(()=>updateWorldModel({model:{...model,entities:[model.entities[0],model.entities[0]]},observation:event(1,2,'source.one'),maxEntities:2}),/invalid_entity_features/);
 assert.throws(()=>updateWorldModel({model,observation:{...event(1,3,'source.one'),signals:JSON.parse('{"__proto__":3}')} ,maxEntities:2}),/invalid_signals/);
});
test('zero dt and extreme numeric differences do not create NaN/Infinity',()=>{
 const a=updateWorldModel({observation:event(0,-Number.MAX_VALUE,'source.extreme',0)});
 const b=updateWorldModel({model:a.model,observation:event(1,Number.MAX_VALUE,'source.extreme',0)});
 const p=b.changes.find(x=>x.feature==='position');
 assert.equal(p.delta,null);assert.equal(p.ratePerMs,null);
 validateModel(b.model);
});
test('120 sequential updates recover from serialized snapshots and match uninterrupted run',()=>{
 const apply=(model,start,end)=>{for(let i=start;i<end;i++)model=updateWorldModel({model,observation:event(i,Math.min(i,7))}).model;return model;};
 const baseline=apply(null,0,120);
 let restored=apply(null,0,47);
 restored=JSON.parse(JSON.stringify(restored));
 restored=apply(restored,47,83);
 restored=JSON.parse(JSON.stringify(restored));
 restored=apply(restored,83,120);
 assert.deepEqual(restored,baseline);
 assert.equal(restored.entities[0].samples,120);
});
