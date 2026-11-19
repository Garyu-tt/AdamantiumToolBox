import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {fixture} from './fixture.mjs';
import {ORIGIN} from '../lib/contract.mjs';
const secret='test-independent-anchor-internal-key-long';
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function serve(f,caps='network_anchor.read,network_anchor.write'){
 const port=await free(),path=join(import.meta.dirname,'../service.mjs');
 const child=spawn(process.execPath,[path],{env:{...process.env,ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,
  APP_PORT:String(port),NETWORK_ANCHOR_LOG:f.logPath,NETWORK_ANCHOR_KEY:f.keyPath,
  NETWORK_ANCHOR_TRUST:f.trustPath},stdio:['ignore','ignore','pipe']});
 let error='';child.stderr.on('data',s=>error+=String(s).slice(0,500));
 const url='http://127.0.0.1:'+port;
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('early_exit:'+error);
  try{if((await fetch(url+'/health',{signal:AbortSignal.timeout(300)})).ok)return {url,child};}catch{}await pause(40);}
 child.kill();throw Error('not_ready:'+error);
}
async function stop(child){if(!child||child.exitCode!==null)return;
 child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null;i++)await pause(40);
 if(child.exitCode===null)child.kill('SIGKILL');}
async function call(url,action,params={},token=secret){const response=await fetch(url+'/invoke',{method:'POST',
 headers:{'X-Internal-Key':token,'Content-Type':'application/json'},body:JSON.stringify({action,params})});
 return {status:response.status,body:await response.json()};}
test('local MAS HTTP authenticates, seals, rejects forbidden OS changes and revokes corrupt journal',async()=>{
 const f=await fixture();let proc;try{proc=await serve(f);const url=proc.url;
  assert.equal((await fetch(url+'/graph')).status,401);
  assert.equal((await call(url,'network_anchor.apply')).status,403);
  const g=await fetch(url+'/graph',{headers:{'X-Internal-Key':secret}});const graph=await g.json();
  assert.equal(graph.nodes.filter(x=>x.type==='action').length,4);
  const row=f.next(),signed=await call(url,'network_anchor.commit',{batch:[row],expectedRevision:ORIGIN});
  assert.equal(signed.status,200,JSON.stringify(signed.body));
  const inspect=await call(url,'network_anchor.inspect',{entry:row});
  assert.equal(inspect.body.result.state,'matches_anchor');
  const duplicate=await call(url,'network_anchor.commit',{batch:[row],expectedRevision:ORIGIN});
  assert.equal(duplicate.status,409);
  assert.equal((await call(url,'network_anchor.latest')).body.result.attestation.attestation.witnessSeq,1);
  await writeFile(f.logPath,(await readFile(f.logPath,'utf8')).replace('approval','tampered'));
  const after=await fetch(url+'/graph',{headers:{'X-Internal-Key':secret}});
  assert(!(await after.json()).nodes.some(x=>x.id==='network_anchor.commit'));
  assert.equal((await call(url,'network_anchor.commit',{batch:[],expectedRevision:ORIGIN})).status,403);
 }finally{await stop(proc?.child);await f.remove();}
});
