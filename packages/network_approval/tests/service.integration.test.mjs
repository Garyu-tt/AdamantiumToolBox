import test from 'node:test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {message} from '../lib/contract.mjs';
import {launch} from './http-fixture.mjs';
test('full HTTP flow signed by two keys and revoked by one, never enforcement', {timeout:20000},async()=>{
 const f=await launch();try{
  assert.equal((await f.req('/graph',null,false)).status,401);
  assert.equal((await f.invoke('network_approval.apply',{})).status,403);
  const status=(await f.invoke('network_approval.status',{})).data.result;
  assert.equal(status.configured,true);assert.equal(status.enforcement,false);
  const flow={source:'alpha',destination:'beta',principal:'owner',protocol:'tcp',port:443};
  const prepared=(await f.invoke('network_approval.prepare',{flow,revision:'v1',expiresAt:new Date(Date.now()+150000).toISOString()})).data.result;
  const request=prepared.request;
  const submitted=await f.invoke('network_approval.propose',{request,proof:f.proof(request,'source'),expectedRevision:status.revision});
  assert.equal(submitted.status,200);assert.equal(submitted.data.result.record.state,'pending');
  const challenge=await f.invoke('network_approval.challenge',{type:'endorse',id:request.id});
  assert.equal(challenge.status,200);assert.equal(challenge.data.result.payload,message(request,'destination').toString('base64'));
  const endorsed=await f.invoke('network_approval.endorse',{id:request.id,proof:f.proof(request,'destination'),expectedRevision:submitted.data.result.revision});
  assert.equal(endorsed.status,200);assert.equal(endorsed.data.result.record.state,'bilaterally_signed');
  assert.equal(endorsed.data.result.record.enforcement,false);
  const revoke=await f.invoke('network_approval.revoke',{id:request.id,reason:'policy_change',proof:f.proof(request,'destination','revoke','policy_change'),expectedRevision:endorsed.data.result.revision});
  assert.equal(revoke.status,200);assert.equal(revoke.data.result.record.state,'revoked');
  const list=(await f.invoke('network_approval.list',{})).data.result;
  assert.equal(list.count,3);assert.equal(list.requests[0].state,'revoked');
  assert(!JSON.stringify(list).includes('signature'),'signatures should remain server-side');
 }finally{await f.dispose();}
});
test('missing journal never exposes write actions', {timeout:20000},async()=>{
 const f=await launch({configured:false});try{
  const g=(await f.req('/graph')).data;
  assert(!g.nodes.some(x=>x.id==='network_approval.propose'));
  assert.equal((await f.invoke('network_approval.propose',{})).status,403);
  const status=(await f.invoke('network_approval.status',{})).data.result;
  assert.equal(status.configured,false);
 }finally{await f.dispose();}
});
test('corrupted journal withdraws write capability and fails closed', {timeout:20000},async()=>{
 const f=await launch();try{
  await writeFile(f.journal,'{"incomplete":true}',{mode:0o600});
  const g=(await f.req('/graph')).data;
  assert(!g.nodes.some(x=>x.id==='network_approval.propose'));
  assert.equal((await f.invoke('network_approval.endorse',{})).status,403);
  assert.equal((await f.invoke('network_approval.status',{})).data.result.configured,false);
 }finally{await f.dispose();}
});
test('runtime permission narrowing hides and rejects mutations', {timeout:20000},async()=>{
 const f=await launch({caps:'network_approval.read'});try{
  const g=(await f.req('/graph')).data;
  assert(g.nodes.some(x=>x.id==='network_approval.status'));
  assert.equal((await f.invoke('network_approval.propose',{})).status,403);
 }finally{await f.dispose();}
});
