import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const exe=fileURLToPath(new URL('../apps/genworldmodel/service.mjs',import.meta.url));
const path=fileURLToPath(new URL('../apps/genworldmodel/manifest.json',import.meta.url));
const secret='a-test-mas-internal-key-123456789';
const manifest=JSON.parse(await readFile(path,'utf8'));
const port=await new Promise((ok,bad)=>{const s=createServer();s.once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,[exe],{env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret},stdio:'ignore'});
test('isolated MAS service authenticates, validates contract, applies changes, no fictitious Genesis',async()=>{
 try{
  let ready=false;
  for(let i=0;i<80;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(200)})).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,30));
  }
  assert(ready);
  assert.equal((await fetch(base+'/graph')).status,401);
  const g=await(await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
  assert(validateManifest(manifest));assert(validateGraph(g,manifest));
  assert.equal(g.nodes.find(n=>n.id==='genworldmodel.update')?.contract,'genesis.worldmodel.update.v1');
  const call=async(action,params={})=>{const r=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action,params})});return {code:r.status,data:await r.json()};};
  const obs={schema:'genesis.sensory.normalized.v1',source:'world.mock',kind:'position',sequence:0,
   observedAtMs:0,traceId:null,unit:'raw',signals:{position:4},payloadSha256:'e'.repeat(64)};
  const a=await call('genworldmodel.update',{observation:obs});
  assert.equal(a.code,200);assert.equal(a.data.result.model.revision,1);
  const replay=await call('genworldmodel.update',{observation:obs,model:a.data.result.model});
  assert.equal(replay.data.result.status,'duplicate');
  const gap=await call('genworldmodel.update',{observation:{...obs,sequence:3},model:a.data.result.model});
  assert.equal(gap.code,409);
  assert.equal((await call('genworldmodel.launch')).code,404);
 }finally{child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
});
