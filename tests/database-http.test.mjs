import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const service=resolve(fileURLToPath(new URL('../apps/database/service.mjs',import.meta.url)));
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const root=await mkdtemp(join(tmpdir(),'mas-http-')),port=await free();
const secret='synthetic-http-test-secret-over-24-chars';
const env={...process.env,DATABASE_DATA_DIR:root,APP_PORT:String(port),ADA_INTERNAL_KEY:secret,DATABASE_MODULE_POLICY:'{"indexing":false}',
 DATABASE_STORAGE_POLICY:JSON.stringify({schema:'mas-database-policy-1',tier:'edge',
  maxJournalBytes:1048576,maxBackups:0,allowWrites:true})};
const child=spawn(process.execPath,[service],{env,stdio:'ignore'}),url='http://127.0.0.1:'+port;
try{
 let health;
 for(let i=0;i<50;i++){
  try{health=await (await fetch(url+'/health')).json();break;}catch{if(child.exitCode!==null)throw Error('service_failed');await pause(100);}
 }
 assert.equal(health.app,'database');
 assert(health.modules.some(m=>m.name==='indexing'&&m.state==='disabled'));
 assert.equal((await fetch(url+'/graph')).status,401);
 const headers={'X-Internal-Key':secret};
 const graph=await (await fetch(url+'/graph',{headers})).json();
 assert(graph.nodes.some(n=>n.capability==='storage.graph.write'));
 assert(!graph.nodes.some(n=>n.id==='database.subjects'));
 const invoke=async(action,params)=>{const res=await fetch(url+'/invoke',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action,params})});return {status:res.status,body:await res.json()};};
 assert.equal((await invoke('database.transact',{namespace:'ns1',observed_seq:0,mutation_uid:'first',operations:[{kind:'ASSERT',fact:{uid:'x1',subject_uid:'a',relation_uid:'is',typed_value:1}}]})).status,200);
 assert.equal((await invoke('database.query',{namespace:'ns1'})).body.result.facts.length,1);
 assert.equal((await invoke('database.subjects',{namespace:'ns1'})).status,400);
 console.log('DATABASE_HTTP_OK auth-dynamic-graph-disabled-modules-mutations');
}finally{child.kill('SIGTERM');await pause(250);await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
