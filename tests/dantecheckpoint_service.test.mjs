import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const app=fileURLToPath(new URL('../apps/dantecheckpoint/service.mjs',import.meta.url));
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../apps/dantecheckpoint/manifest.json',import.meta.url)),'utf8'));
const secret='internal-key-for-local-testing-1234567';
const port=()=>new Promise((ok,fail)=>{const s=createServer();s.once('error',fail);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
test('independent service auth, checkpoint and process restart readback',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-checkpoint-http-')),p=await port();let child;
 const base='http://127.0.0.1:'+p;
 async function start(){
  child=spawn(process.execPath,[app],{env:{...process.env,APP_PORT:String(p),ADA_INTERNAL_KEY:secret,DANTE_CHECKPOINT_PATH:join(dir,'checkpoint.json')},stdio:'ignore'});
  let ready=false;
  for(let i=0;i<80;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(200)})).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;
   await new Promise(r=>setTimeout(r,40));
  }
  assert(ready,'service not started');
 }
 async function stop(){child?.kill();if(child?.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
 const call=async(action,params)=>{
  const r=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action,params})});
  return {code:r.status,...(await r.json())};
 };
 try{
  await start();assert.equal((await fetch(base+'/graph')).status,401);
  const graph=await (await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
  assert(validateManifest(manifest));assert(validateGraph(graph,manifest));
  assert.equal(graph.nodes.find(n=>n.id==='dantecheckpoint.commit').contract,'dante.state.checkpoint.v1');
  const commit=await call('dantecheckpoint.commit',{instanceId:'dante.test',expectedRevision:0,lastEventId:'e'.repeat(64),state:{mood:'test'}});
  assert.equal(commit.code,200);assert.equal(commit.result.revision,1);
  await stop();await start();
  const read=await call('dantecheckpoint.restore',{});assert.equal(read.result.state.mood,'test');
  assert.equal(read.result.lastEventId,'e'.repeat(64));
  assert.equal((await call('dantecheckpoint.launch',{})).code,400);
  console.log('DANTE_CHECKPOINT_SERVICE_OK restart/readback, no fake Genesis');
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
