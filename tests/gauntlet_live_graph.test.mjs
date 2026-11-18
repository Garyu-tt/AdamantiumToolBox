import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleHash} from '../apps/gauntlet/shared.mjs';
const base=resolve(fileURLToPath(new URL('..',import.meta.url)));
const state=await mkdtemp(join(tmpdir(),'gauntlet-graph-'));
const free=()=>new Promise(done=>{
 const s=createServer();s.listen(0,'127.0.0.1',()=>{
  const port=s.address().port;s.close(()=>done(port));
 });
});
const port=await free(),secret='test-secret-key-long-enough-for-gauntlet';
const child=spawn(process.execPath,[join(base,'apps','gauntlet','service.mjs')],{
 env:{...process.env,GAUNTLET_STATE_DIR:state,ADA_INTERNAL_KEY:secret,
  APP_PORT:String(port)},stdio:'ignore'});
const url='http://127.0.0.1:'+port;
const headers={'X-Internal-Key':secret,'Content-Type':'application/json'};
const graph=async()=>await(await fetch(url+'/graph',{headers})).json();
const invoke=async(action,params)=>await(await fetch(url+'/invoke',{method:'POST',
 headers,body:JSON.stringify({action,params})})).json();
const manifest={mas:'1.0',id:'specimen',name:'Specimen',version:'0.1.0',
 icon:'graph',lifecycle:'independent',service:{protocol:'mas-http-1',port:8999},
 ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},
 auth:{mode:'host-delegated'},permissions:['specimen.read'],
 events:{schema:'mas-event-1'},data:{refs:'mas-ref-1'},
 updates:{strategy:'semver',migrations:[]}};
const files={'manifest.json':JSON.stringify(manifest),
 'service.mjs':'export const ok=true;\n','view.js':'export const view=true;\n'};
try{
 let ready=false;
 for(let i=0;i<60;i++){
  if(child.exitCode!==null)throw Error('service_crashed');
  try{const r=await fetch(url+'/health');ready=r.ok;if(ready)break;}catch{}
  await new Promise(ok=>setTimeout(ok,100));
 }
 assert(ready,'gauntlet_service_unavailable');
 assert.equal((await graph()).nodes.filter(n=>n.type==='resource').length,0);
 assert.equal((await fetch(url+'/graph')).status,401);
 const input={task_id:'graph-case-01',plugin_id:'specimen',
  author_id:'claude',files,sha256:'0'.repeat(64)};
 let c=(await invoke('gauntlet.submit',input)).result;
 assert.equal(c.status,'BLOCKED');
 const g=await graph(),blocker=g.nodes.find(n=>n.type==='resource');
 assert(blocker);assert(blocker.diagnostic);
 assert.equal(blocker.status,'BLOCKED');
 assert(g.edges.some(e=>e.to===blocker.id));
 const diag=(await invoke('gauntlet.detail',{task_id:input.task_id})).result;
 assert.equal(diag.diagnostic.task_id,input.task_id);
 assert(diag.diagnostic.issues.includes('checksum_mismatch'));
 assert.equal(diag.case.diagnostic,blocker.diagnostic);
 const queued=(await invoke('gauntlet.outbox',{kind:'fixiki-outbox'})).result;
 assert.equal(queued.length,1);
 assert.equal(queued[0].required_capability,'task.blocker.triage');
 assert.equal(queued[0].status,'PENDING_DISPATCH');
 c=(await invoke('gauntlet.submit',{...input,sha256:bundleHash(files)})).result;
 assert.equal(c.status,'BUILDING');
 assert.equal((await graph()).nodes.filter(n=>n.type==='resource').length,0);
 console.log('GAUNTLET_LIVE_GRAPH_OK live blocker add/remove and diagnostic action');
}finally{
 if(child.exitCode===null){child.kill();await Promise.race([once(child,'exit'),
  new Promise(ok=>setTimeout(ok,2000))]);}
 await rm(state,{recursive:true,force:true});
}
