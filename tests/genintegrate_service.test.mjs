import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const exe=fileURLToPath(new URL('../apps/genintegrate/service.mjs',import.meta.url));
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../apps/genintegrate/manifest.json',import.meta.url)),'utf8'));
const secret='test-genintegrate-internal-key-length-32';
const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n));});});
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,[exe],{env:{...process.env,ADA_INTERNAL_KEY:secret,APP_PORT:String(port)},stdio:'ignore'});
test('MAS Core+App contract, auth, pure invocation and no fictitious cognition',async()=>{
 try{
  let ready=false;
  for(let i=0;i<60;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(250)})).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;
   await new Promise(r=>setTimeout(r,40));
  }
  assert(ready,'integrator not listening');
  assert.equal((await fetch(base+'/graph')).status,401);
  const graph=await (await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
  assert(validateManifest(manifest));assert(validateGraph(graph,manifest));
  assert.equal(graph.nodes.find(n=>n.id==='genintegrate.integrate')?.contract,'genesis.sensory.integrate.v1');
  const sample={schema:'genesis.sensory.normalized.v1',source:'world.mock',kind:'position',sequence:0,
   observedAtMs:0,unit:'raw',traceId:null,payloadSha256:'a'.repeat(64),signals:{position:3}};
  const invoke=async(action,params)=>{
   const response=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action,params})});
   return {status:response.status,body:await response.json()};
  };
  const accepted=await invoke('genintegrate.integrate',{event:sample});
  assert.equal(accepted.status,200);assert.equal(accepted.body.result.context.count,1);
  const duplicate=await invoke('genintegrate.integrate',{event:sample,context:accepted.body.result.context});
  assert.equal(duplicate.body.result.status,'duplicate');
  assert.equal((await invoke('genintegrate.launch',{event:sample})).status,404);
  assert.equal((await invoke('genintegrate.integrate',{event:{...sample,sequence:2},context:accepted.body.result.context})).status,409);
  console.log('GENINTEGRATE_SERVICE_OK independent CPU provider, no Genesis activation');
 }finally{child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
});
