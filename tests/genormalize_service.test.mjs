import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const exe=fileURLToPath(new URL('../apps/genormalize/service.mjs',import.meta.url));
const secret='test-key-at-least-24-characters';
const port=await new Promise((ok,bad)=>{const s=createServer();s.once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>ok(n));});});
const child=spawn(process.execPath,[exe],{env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret},stdio:'ignore'});
const base='http://127.0.0.1:'+port;
test('standalone authenticated service, graph and invoke',async()=>{
 try{
  let ready=false;
  for(let i=0;i<80;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(250)})).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;
   await new Promise(r=>setTimeout(r,30));
  }
  assert(ready,'service failed to listen');
  assert.equal((await fetch(base+'/graph')).status,401);
  const graph=await (await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
  assert.equal(graph.app,'genormalize');
  assert.equal(graph.nodes.find(x=>x.id==='genormalize.normalize').contract,'genesis.sensory.normalize.v1');
  const req={action:'genormalize.normalize',params:{event:{schema:'dante.sensory.event.v1',
   source:'world.mock',kind:'position',sequence:1,observedAtMs:1,payload:{position:2}}}};
  const r=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify(req)});
  assert.equal(r.status,200);assert.equal((await r.json()).result.signals.position,2);
  assert.equal((await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action:'genormalize.launch'})})).status,404);
  console.log('GENORMALIZE_SERVICE_OK standalone auth + typed action; no fake Genesis');
 }finally{child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
});
