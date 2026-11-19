import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const service=fileURLToPath(new URL('../apps/dantesensory/service.mjs',import.meta.url));
const secret='test-only-long-internal-key-0123456789';
const free=()=>new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});
});

test('sensory /invoke enforces UTF-8 byte cap with JSON 413 and no queue mutation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-sensory-boundary-'));
 const port=await free(),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[service],{
  env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret,
   DANTE_SENSOR_QUEUE_PATH:join(dir,'queue.json')},stdio:'ignore'
 });
 const call=async(body,headers={'X-Internal-Key':secret})=>{
  const response=await fetch(base+'/invoke',{method:'POST',headers,body});
  return {status:response.status,body:await response.json()};
 };
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(250)})).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;
   await new Promise(resolve=>setTimeout(resolve,30));
  }
  assert(ready,'service did not start');
  const status=()=>call(JSON.stringify({action:'dantesensory.status'}));
  assert.equal((await status()).body.result.queued,0);
  for(const padding of ['x'.repeat(21000),'界'.repeat(7000)]){
   const payload=JSON.stringify({action:'dantesensory.publish',
    params:{event:{schema:'dante.sensory.event.v1',source:'world.mock',
     kind:'position',sequence:0,observedAtMs:0,payload:{position:1}}},
    padding});
   assert(Buffer.byteLength(payload)>20000);
   const rejected=await call(payload);
   assert.equal(rejected.status,413);
   assert.deepEqual(rejected.body,{error:'request_too_large'});
   assert.equal((await status()).body.result.queued,0,'oversize request must not publish');
  }
  assert.equal((await call('x'.repeat(21000),{})).status,401,'auth must precede parsing');
  const event={schema:'dante.sensory.event.v1',source:'world.mock',
   kind:'position',sequence:0,observedAtMs:0,payload:{position:1}};
  const accepted=await call(JSON.stringify({action:'dantesensory.publish',params:{event}}));
  assert.equal(accepted.status,200);
  assert.equal(accepted.body.result.ok,true);
  assert.equal((await status()).body.result.queued,1);
 }finally{
  child.kill();
  if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);
  await rm(dir,{recursive:true,force:true});
 }
});
