import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {updateWorldModel} from '../apps/genworldmodel/reducer.mjs';
import {signalsDigest,validateModel} from '../apps/genworldmodel/schema.mjs';
const raw='a'.repeat(64);
const obs=(signals,extra={})=>({schema:'genesis.sensory.normalized.v1',
 source:'world.mock',kind:'position',sequence:7,observedAtMs:1234,
 traceId:null,unit:'raw',signals,payloadSha256:raw,...extra});
test('forged unchanged raw hash cannot hide changed signals',()=>{
 const first=updateWorldModel({observation:obs({position:1,target:5})});
 assert.throws(()=>updateWorldModel({model:first.model,
  observation:obs({position:999,target:5})}),/sequence_conflict/);
 assert.equal(updateWorldModel({model:first.model,
  observation:obs({target:5,position:1})}).status,'duplicate');
});
test('same sequence and raw hash with changed timestamp conflicts',()=>{
 const first=updateWorldModel({observation:obs({position:1})});
 assert.throws(()=>updateWorldModel({model:first.model,
  observation:obs({position:1},{observedAtMs:1235})}),/sequence_conflict/);
});
test('tampered or legacy stored signal digest fails closed',()=>{
 const first=updateWorldModel({observation:obs({position:1})});
 const corrupted=structuredClone(first.model);
 corrupted.entities[0].features.position=99;
 assert.throws(()=>validateModel(corrupted),/invalid_entity/);
 const legacy=structuredClone(first.model);
 delete legacy.entities[0].signalsSha256;
 assert.throws(()=>updateWorldModel({model:legacy,observation:obs({position:1})}),/invalid_entity/);
});
test('signal digest stable across insertion order and restarts',()=>{
 assert.equal(signalsDigest({a:1,b:2}),signalsDigest({b:2,a:1}));
 const first=updateWorldModel({observation:obs({position:1})});
 const restored=JSON.parse(JSON.stringify(first.model));
 assert.equal(updateWorldModel({model:restored,observation:obs({position:1})}).status,'duplicate');
});
