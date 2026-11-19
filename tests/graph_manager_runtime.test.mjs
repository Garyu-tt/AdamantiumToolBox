import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const port=await new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const p=s.address().port;s.close(()=>ok(p));});});
const secret='test-internal-key-with-adequate-length';
const entry=fileURLToPath(new URL('../apps/graph_manager/service.mjs',import.meta.url));
const child=spawn(process.execPath,[entry],{env:{...process.env,ADA_INTERNAL_KEY:secret,
 APP_PORT:String(port)},stdio:'ignore'});
const base='http://127.0.0.1:'+port;
async function get(path,headers){return fetch(base+path,{headers,signal:AbortSignal.timeout(800)});}
try{
 let ready=false;
 for(let i=0;i<50;i++){
  try{if((await get('/health')).ok){ready=true;break;}}catch{}
  if(child.exitCode!==null)throw Error('child_died');
  await new Promise(ok=>setTimeout(ok,80));
 }
 assert(ready,'server_not_ready');
 assert.equal((await get('/graph')).status,401);
 const authorized={'x-internal-key':secret};
 const graph=await (await get('/graph',authorized)).json();
 assert.equal(graph.app,'graph_manager');assert.equal(graph.nodes.length,1);
 assert.equal((await get('/invoke',authorized)).status,404);
 console.log('GRAPH_MANAGER_RUNTIME_OK core-app graph endpoint auth no mutation');
}finally{
 if(child.exitCode===null){child.kill();await Promise.race([once(child,'exit'),
  new Promise(ok=>setTimeout(ok,2000))]);}
}