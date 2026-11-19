import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const executable=fileURLToPath(new URL('../apps/genselfstate/service.mjs',import.meta.url));
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../apps/genselfstate/manifest.json',import.meta.url)),'utf8'));
const secret='test-self-state-only-key-long-enough';
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});
});
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,[executable],{env:{...process.env,ADA_INTERNAL_KEY:secret,APP_PORT:String(port)},stdio:'ignore'});
test('standalone MAS HTTP service denies unauthenticated callers and never launches Genesis',async()=>{
 try{
  let ready=false;for(let i=0;i<80;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(250)})).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,30));
  }assert(ready);
  assert.equal((await fetch(base+'/graph')).status,401);
  assert(validateManifest(manifest));
  const g=await(await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
  assert(validateGraph(g,manifest));
  assert.equal(g.nodes.find(n=>n.id==='genselfstate.snapshot').contract,'genesis.selfstate.snapshot.v1');
  const call=async(action,params)=>{
   const r=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action,params})});
   return {code:r.status,data:await r.json()};
  };
  const data=await call('genselfstate.snapshot',{instanceId:'dante.test',lastEventId:'f'.repeat(64),components:[{slot:'perception',contract:'genesis.sensory.integrate.v1',state:{count:2}}]});
  assert.equal(data.code,200);assert.equal(data.data.result.instanceId,'dante.test');
  assert.equal(data.data.result.revision,0);
  assert.equal((await call('genselfstate.launch',{})).code,404);
  assert.equal((await call('genselfstate.snapshot',{instanceId:'???'})).code,400);
 }finally{child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
});
