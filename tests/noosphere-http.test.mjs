import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {mkdtemp,readdir,rm,readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const service=resolve(fileURLToPath(new URL('../apps/noosphere/service.mjs',import.meta.url)));
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>ok(port));});});
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const cwd=await mkdtemp(join(tmpdir(),'noosphere-empty-'));
const secret='synthetic-r03-secret-with-at-least-24-chars';
const manifest=JSON.parse(await readFile(new URL('../apps/noosphere/manifest.json',import.meta.url),'utf8'));
async function probe(policy,expectValidate){
 const port=await free(),url='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[service],{cwd,env:{...process.env,APP_PORT:String(port),
  ADA_INTERNAL_KEY:secret,NOOSPHERE_MODULE_POLICY:JSON.stringify(policy)},stdio:'ignore'});
 try{
  let state;
  for(let i=0;i<50;i++){
   try{const r=await fetch(url+'/health');if(r.ok){state=await r.json();break;}}catch{}
   if(child.exitCode!==null)throw Error('service_crashed');await pause(100);
  }
  assert(state,'health_timeout');
  assert.equal(state.version,manifest.version,'health must reflect packaged manifest version');
  assert.equal(state.storage,'not_connected');
  assert.equal(state.mode,'stateless');
  assert.equal(state.persistent,false);
  assert.equal((await fetch(url+'/graph')).status,401);
  const headers={'X-Internal-Key':secret};
  const graph=await (await fetch(url+'/graph',{headers})).json();
  const actions=graph.nodes.filter(n=>n.type==='action').map(n=>n.id);
  assert(actions.includes('noosphere.status'));
  assert.equal(actions.includes('noosphere.validate'),expectValidate);
  assert(!actions.some(n=>/write|store|persist|save|query/.test(n)));
  const invoke=async(action,params={})=>{
   const r=await fetch(url+'/invoke',{method:'POST',headers:{...headers,
    'Content-Type':'application/json'},body:JSON.stringify({action,params})});
   return {status:r.status,body:await r.json()};
  };
  assert.equal((await invoke('noosphere.status')).body.result.persistent,false);
  assert.equal((await invoke('noosphere.memory.write')).status,400);
  const checked=await invoke('noosphere.validate',{envelope:{}});
  assert.equal(checked.status,expectValidate?200:400);
  if(expectValidate)assert.equal(checked.body.result.valid,false);
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');}
}
try{
 await probe({},true);
 await probe({ingestion:false},false);
 assert.deepEqual(await readdir(cwd),[]);
 console.log('NOOSPHERE_HTTP_R03_OK no-storage-no-phantom-actions-isolation-auth');
}finally{await rm(cwd,{recursive:true,force:true});}
