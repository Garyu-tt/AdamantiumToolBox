import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {propose} from '../apps/genpropose/proposer.mjs';
const entity=JSON.stringify(['world.mock','position']);
const model=(position=1)=>({schema:'genesis.worldmodel.state.v1',revision:5,lastEventId:null,entities:[{id:entity,features:{position}}]});
const goal={entityId:entity,feature:'position',target:4};
const action={id:'move.right',scope:'virtual',mode:'simulate',entityId:entity,feature:'position',delta:1,cost:0};
test('generates deterministic sandbox proposals without mutating model',()=>{
 const state=model(),p=propose({model:state,goal,actions:[action]});
 assert.equal(p.candidates[0].id,'move.right');assert.equal(p.candidates[0].utility,1);
 assert.equal(p.executable,false);assert.equal(state.entities[0].features.position,1);
 assert.deepEqual(propose({model:state,goal,actions:[action]}),p);
 assert.match(p.basis,/^[0-9a-f]{64}$/);
});
test('no invented candidate, fail closed on dangerous action scope/input',()=>{
 const missing=propose({model:model(),goal:{...goal,feature:'unknown'},actions:[]});
 assert.equal(missing.reason,'unknown_feature');assert.equal(missing.candidates.length,0);
 assert.throws(()=>propose({model:model(),goal,actions:[{...action,scope:'external'}]}),/invalid_virtual_action/);
 assert.throws(()=>propose({model:model(),goal,actions:[action,action]}),/invalid_virtual_action/);
 assert.throws(()=>propose({model:model(),goal,actions:[{...action,delta:Infinity}]}),/invalid_virtual_action/);
 assert.throws(()=>propose({model:model(),goal,actions:[{...action,mode:'execute'}]}),/invalid_virtual_action/);
 assert.equal(propose({model:model(4),goal,actions:[action]}).candidates[0].utility,-1);
});
