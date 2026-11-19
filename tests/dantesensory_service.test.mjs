import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const service=fileURLToPath(new URL('../apps/dantesensory/service.mjs',import.meta.url));
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../apps/dantesensory/manifest.json',import.meta.url)),'utf8'));
const secret='test-only-long-internal-key-0123456789';
const free=()=>new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
});
test('isolated MAS service: auth, graph, at-least-once through process restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-sensory-http-')),port=await free();
 const base='http://127.0.0.1:'+port;
 let child;
 async function start(){
  child=spawn(process.execPath,[service],{env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret,DANTE_SENSOR_QUEUE_PATH:join(dir,'queue.json')},stdio:'ignore'});
  let ready=false;for(let i=0;i<100;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(250)})).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,30));
  }assert(ready,'queue service failed to listen');
 }
 async function stop(){child?.kill();if(child?.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
 const call=async(action,params={})=>{
  const r=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action,params})});
  return {status:r.status,...(await r.json())};
 };
 try{
  await start();assert.equal((await fetch(base+'/graph')).status,401);
  const spec=await (await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
  assert(validateManifest(manifest));assert(validateGraph(spec,manifest));
  assert.equal(spec.nodes.find(n=>n.id==='dantesensory.publish').contract,'dante.sensory.deliver.v1');
  const event={schema:'dante.sensory.event.v1',source:'world.mock',kind:'position',sequence:0,observedAtMs:0,payload:{position:4}};
  const sent=await call('dantesensory.publish',{event});assert(sent.result.ok);
  assert.equal((await call('dantesensory.peek')).result[0].id,sent.result.id);
  await stop();await start();
  assert.equal((await call('dantesensory.peek')).result[0].id,sent.result.id,'must replay after process restart');
  assert.equal((await call('dantesensory.ack',{id:sent.result.id})).result.ok,true);
  await stop();await start();assert.equal((await call('dantesensory.peek')).result.length,0);
  assert.equal((await call('dantesensory.ack',{id:sent.result.id})).result.already,true);
  assert.equal((await call('dantesensory.launch')).status,400);
  console.log('DANTE_SENSOR_SERVICE_OK authenticated MAS graph, replay through process restart');
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
