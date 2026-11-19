import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const port=await new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const p=s.address().port;s.close(()=>ok(p));});});
const root=await mkdtemp(join(tmpdir(),'ada-taskgraph-'));
const secret='internal-only-long-secret-for-tests';
const entry=fileURLToPath(new URL('../apps/task_pool/service.mjs',import.meta.url));
const child=spawn(process.execPath,[entry],{env:{...process.env,LOCALAPPDATA:root,
 ADA_INTERNAL_KEY:secret,ADA_CAPS:'tasks.read',APP_PORT:String(port)},stdio:'ignore'});
const url='http://127.0.0.1:'+port;
try{
 let ready=false;
 for(let i=0;i<60;i++){
  try{if((await fetch(url+'/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}
  if(child.exitCode!==null)throw Error('task_pool_child_died');
  await new Promise(ok=>setTimeout(ok,60));
 }
 assert(ready);
 assert.equal((await fetch(url+'/graph')).status,401);
 const res=await fetch(url+'/graph',{headers:{'x-internal-key':secret}});
 assert.equal(res.status,200);
 const graph=await res.json();
 assert.equal(graph.app,'task_pool');
 assert(graph.nodes.some(x=>x.id==='task_pool.list'&&x.type==='action'));
 assert(!graph.nodes.some(x=>x.id==='task_pool.claim'));
 const index=graph.nodes.find(x=>x.id==='task_pool.index');
 assert(index&&index.type==='resource');
 assert.deepEqual(index.requires,['tasks.read']);
 assert.equal(index.provider.schema,'mas-task-provider-1');
 assert.equal(index.provider.listAction,'task_pool.list');
 assert(!graph.nodes.some(x=>x.id==='task_pool.provider'));
 console.log('TASK_POOL_READONLY_GRAPH_OK list descriptor without claim rights');
}finally{
 if(child.exitCode===null){child.kill();await Promise.race([once(child,'exit'),
  new Promise(ok=>setTimeout(ok,1500))]);}
 await rm(root,{recursive:true,force:true});
}
