// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {fixture} from './fixture.mjs';
const secret='factory-anchor-test-internal-key-long';
const free=()=>new Promise(resolve=>{
 const s=createServer();s.listen(0,'127.0.0.1',()=>{
  const p=s.address().port;s.close(()=>resolve(p));
 });
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(f,{caps='factory_anchor.read',signing=false}={}){
 const port=await free();
 const app=join(import.meta.dirname,'../service.mjs');
 const child=spawn(process.execPath,[app],{env:{
  ...process.env,ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,
  APP_PORT:String(port),FACTORY_ANCHOR_ROOT:f.root,
  FACTORY_ANCHOR_PUBLIC_PIN:f.anchorPin,FACTORY_ANCHOR_SOURCE_PIN:f.sourcePin,
  FACTORY_ANCHOR_LEDGER_ID:f.ledgerId,
  FACTORY_ANCHOR_ALLOW_SIGNING:signing?'yes':'no'
 },stdio:['ignore','ignore','pipe']});
 let error='';child.stderr.on('data',b=>{error=(error+b.toString()).slice(-1400);});
 const url='http://127.0.0.1:'+port;
 for(let i=0;i<95;i++){
  if(child.exitCode!==null)throw Error('service_early_exit:'+error);
  try{
   const r=await fetch(url+'/health',{signal:AbortSignal.timeout(300)});
   if(r.ok)return {child,url};
  }catch{}
  await pause(40);
 }
 child.kill();throw Error('service_not_ready:'+error);
}
async function stop(p){
 if(!p||p.exitCode!==null)return;
 p.kill('SIGTERM');
 for(let i=0;i<80&&p.exitCode===null;i++)await pause(40);
 if(p.exitCode===null)p.kill('SIGKILL');
}
async function invoke(url,action,params={},key=secret,headers={}){
 const r=await fetch(url+'/invoke',{method:'POST',
  headers:{'X-Internal-Key':key,'Content-Type':'application/json',...headers},
  body:JSON.stringify({action,params})
 });
 return {status:r.status,body:await r.json()};
}
test('R09 MAS HTTP denies unsafe actions and browser origin; no signing without grant',async()=>{
 const f=await fixture();let proc;
 try{
  proc=await start(f);const {url}=proc;
  assert.equal((await fetch(url+'/graph')).status,401);
  assert.equal((await fetch(url+'/health')).status,200);
  assert.equal((await invoke(url,'factory_anchor.status',{},'wrong-key')).status,401);
  const graph=await fetch(url+'/graph',{headers:{'X-Internal-Key':secret}});
  assert.equal(graph.status,200);
  const nodes=(await graph.json()).nodes.map(n=>n.id);
  assert.ok(nodes.includes('factory_anchor.inspect'));
  assert.ok(!nodes.includes('factory_anchor.attest'));
  const state=await invoke(url,'factory_anchor.status');
  assert.equal(state.status,200);
  assert.equal(state.body.result.configured,true);
  const draft=await invoke(url,'factory_anchor.inspect',{bundle:f.bundle()});
  assert.equal(draft.body.result.status,'unanchored');
  assert.equal((await invoke(url,'factory_anchor.attest',{bundle:f.bundle()})).status,403);
  assert.equal((await invoke(url,'factory_anchor.install')).status,403);
  assert.equal((await invoke(url,'factory_anchor.publish')).status,403);
  assert.equal((await invoke(url,'factory_anchor.status',{},secret,
   {Origin:'https://untrusted.example'})).status,403);
  assert.equal((await readFile(join(f.root,'anchor.jsonl'),'utf8')),'');
 }finally{await stop(proc?.child);await f.remove();}
});
test('R09 signing opt-in + host policy advertised only while store healthy',async()=>{
 const f=await fixture();let proc;
 try{
  proc=await start(f,{caps:'factory_anchor.read,factory_anchor.attest',signing:true});
  const {url}=proc;
  const spec=await fetch(url+'/graph',{headers:{'X-Internal-Key':secret}});
  const actions=(await spec.json()).nodes.map(n=>n.id);
  assert.ok(actions.includes('factory_anchor.attest'));
  const {verifySource,ZERO}=await import('../lib/proof.mjs');
  const source=verifySource(f.bundle(),{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  const output=await invoke(url,'factory_anchor.attest',{
   bundle:f.bundle(),expectedReceiptHash:ZERO,
   expectedSourceSequence:source.sequence,expectedSourceHead:source.head
  });
  assert.equal(output.status,200,JSON.stringify(output));
  assert.equal(output.body.result.attestation.sourceSequence,1);
  assert.equal(output.body.result.masApprovalGranted,false);
  const verified=await invoke(url,'factory_anchor.inspect',{bundle:f.bundle()});
  assert.equal(verified.body.result.status,'verified_current');
  await writeFile(join(f.root,'anchor.jsonl'),'tampered');
  const after=await fetch(url+'/graph',{headers:{'X-Internal-Key':secret}});
  const active=(await after.json()).nodes.map(n=>n.id);
  assert.ok(!active.includes('factory_anchor.attest'));
  assert.equal((await invoke(url,'factory_anchor.attest',{})).status,403);
  assert.equal((await invoke(url,'factory_anchor.status')).body.result.configured,false);
 }finally{await stop(proc?.child);await f.remove();}
});
