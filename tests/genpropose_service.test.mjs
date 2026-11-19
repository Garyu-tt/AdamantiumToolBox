import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const id='genpropose',secret='test-internal-secret-at-least-24-chars';
const exe=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../apps/'+id+'/manifest.json',import.meta.url)),'utf8'));
const port=await new Promise((ok,bad)=>{const s=createServer();s.once('error',bad);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>ok(n));});});
const base='http://127.0.0.1:'+port,child=spawn(process.execPath,[exe],{env:{...process.env,ADA_INTERNAL_KEY:secret,APP_PORT:String(port)},stdio:'ignore'});
test('isolated genpropose MAS auth, schema, deny absent launch',async()=>{
 try{
  let up=false;for(let i=0;i<70;i++){try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(200)})).ok){up=true;break;}}catch{}
   if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,30));}
  assert(up);assert.equal((await fetch(base+'/graph')).status,401);
  const graph=await (await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
  assert(validateManifest(manifest));assert(validateGraph(graph,manifest));
  assert.equal(graph.nodes.find(x=>x.id===id+'.propose').contract,'genesis.policy.propose.v1');
  const r=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action:id+'.launch'})});
  assert.equal(r.status,404);
 }finally{child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,800))]);}
});
