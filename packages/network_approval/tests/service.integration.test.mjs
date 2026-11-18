import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createServer} from 'node:net';
import {message,revokeMessage} from '../lib/contract.mjs';
const secret='network-approval-internal-key-very-long';
const base=resolve(import.meta.dirname,'..');
const freePort=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stop(c){if(!c||c.exitCode!==null)return;const end=once(c,'exit').catch(()=>{});c.kill();await Promise.race([end,pause(2000)]);}
function makeTrust(){const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');return {a,b,trust:{schema:'network-approval-trust-v1',nodes:{
 alpha:{keyId:'alpha-v1',publicKey:a.publicKey.export({type:'spki',format:'pem'}).toString()},
 beta:{keyId:'beta-v1',publicKey:b.publicKey.export({type:'spki',format:'pem'}).toString()}}}};}
async function launch({caps='network_approval.read,network_approval.write',configured=true}={}){
 const tmp=await mkdtemp(join(tmpdir(),'approval-http-')),port=await freePort();const host='http://127.0.0.1:'+port;
 const {a,b,trust}=makeTrust(),trustFile=join(tmp,'trust.json'),journal=join(tmp,'journal.jsonl');
 await writeFile(trustFile,JSON.stringify(trust),{mode:0o600});
 const env={...process.env,ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,APP_PORT:String(port),
 ...(configured?{NETWORK_APPROVAL_TRUST:trustFile,NETWORK_APPROVAL_JOURNAL:journal}:{} )};
 const child=spawn(process.execPath,[join(base,'service.mjs')],{env,stdio:['ignore','ignore','pipe']});
 let errors='';child.stderr.on('data',b=>errors+=b.toString().slice(-1000));
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('child_exit '+errors);
  try{const r=await fetch(host+'/health',{signal:AbortSignal.timeout(200)});if(r.ok)break;}catch{}await pause(50);
 }
 async function req(path,body,authorized=true){const r=await fetch(host+path,{method:body?'POST':'GET',headers:{...(authorized?{'X-Internal-Key':secret}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};}
 const invoke=(action,params)=>req('/invoke',{action,params});
 const proof=(request,side,type='sign',reason)=>({side,keyId:side==='source'?'alpha-v1':'beta-v1',
  signature:sign(null,type==='revoke'?revokeMessage(request,side,reason):message(request,side),side==='source'?a.privateKey:b.privateKey).toString('base64')});
 return {tmp,host,child,req,invoke,proof,journal,async dispose(){await stop(child);await rm(tmp,{recursive:true,force:true});}};
}
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
