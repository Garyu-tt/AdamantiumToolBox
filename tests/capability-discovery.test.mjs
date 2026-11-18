import {strict as assert} from 'node:assert';
import {registryFromGraphs} from '../core/capabilities/discovery.mjs';
const calls=[];
const provider=(id)=>({app:{id},nodes:[{type:'action',id:id+'.query',
 capability:'storage.graph.read',capabilityVersion:'1.1',operation:'read',requires:['database.read']},
 {type:'action',id:id+'.write',capability:'storage.graph.write',
 capabilityVersion:'1.0',operation:'write',requires:['database.write']} ]});
const r=registryFromGraphs([provider('db1'),provider('db2')],{nodeId:'node-test',
 invoke:async(app,action,params)=>{calls.push({app:app.id,action,params});return {app:app.id};}});
await assert.rejects(r.invoke({name:'storage.graph.write',version:'1.0',operation:'write',scopes:['database.write']}),/write_target_ambiguous/);
const v=await r.invoke({name:'storage.graph.read',version:'1.0',operation:'read',
 scopes:['database.read'],providerId:'db2'});
assert.equal(v.app,'db2');assert.equal(calls[0].action,'db2.query');
assert.throws(()=>r.resolve({name:'storage.graph.read',version:'1.0',operation:'read',scopes:[]}),/capability_unavailable/);
assert.equal(r.list().length,2);
console.log('GRAPH_DISCOVERY_R02_OK versions-permission-provider-target');
