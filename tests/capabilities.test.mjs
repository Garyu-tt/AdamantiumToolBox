import {strict as assert} from 'node:assert';
import {createCapabilityRegistry} from '../core/capabilities/registry.mjs';
const r=createCapabilityRegistry(),calls=[];
const read={name:'storage.graph.read',version:'1.2',operation:'read',
 permission:'memory.read',action:'database.query'};
const write={name:'storage.graph.write',version:'1.0',operation:'write',
 permission:'memory.write',action:'database.transact'};
const provider=(id,extra={})=>({id,nodeId:id,transport:'local',primary:false,
 capabilities:[read,write],invoke:async(action,params,ctx)=>{
  calls.push({id,action,params,ctx});return {id,action,params};},...extra});
const readReq={name:'storage.graph.read',version:'1.0',operation:'read',scopes:['memory.read']};
const writeReq={name:'storage.graph.write',version:'1.0',operation:'write',scopes:['memory.write']};
r.register(provider('local1',{priority:10,primary:true}));
r.register(provider('local2',{priority:20}));
assert.equal((await r.invoke(readReq)).id,'local2');
assert.equal((await r.invoke(writeReq)).id,'local1');
assert.equal((await r.invoke({...writeReq,providerId:'local2'})).id,'local2');
assert.throws(()=>r.resolve({...writeReq,scopes:[]}),/capability_unavailable/);
assert.throws(()=>r.resolve({...readReq,version:'2.0'}),/capability_unavailable/);
assert.throws(()=>r.register(provider('remote1',{transport:'remote',approved:false})),/untrusted/);
r.register(provider('remote1',{transport:'remote',approved:true,identityVerified:true,priority:30}));
assert.equal((await r.invoke(readReq)).id,'remote1');
r.setHealth('remote1',false);
assert.equal((await r.invoke(readReq)).id,'local2');
assert.throws(()=>r.resolve({...readReq,nodeId:'remote1'}),/capability_unavailable/);
r.register(provider('local3',{primary:true}));
assert.throws(()=>r.resolve(writeReq),/write_target_ambiguous/);
assert.equal((await r.invoke({...writeReq,nodeId:'local1'})).id,'local1');
let attempts=0;
r.register(provider('broken',{priority:200,invoke:async()=>{attempts++;throw Error('uncertain_timeout');}}));
await assert.rejects(r.invoke(readReq),/uncertain_timeout/);
assert.equal(attempts,1);
r.unregister('broken');r.unregister('local3');
assert.equal(r.list().length,3);
assert.deepEqual(calls.at(-1).ctx,{providerId:'local1',nodeId:'local1',operation:'write'});
console.log('CAPABILITY_R02_OK negotiation-permission-write-primary-node-pin-trust-health-no-retry');
