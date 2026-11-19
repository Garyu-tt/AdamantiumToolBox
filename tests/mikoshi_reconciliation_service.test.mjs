import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateGraph} from '../core/contract.mjs';
const key=randomBytes(32).toString('hex');
const port=await new Promise((resolve,reject)=>{
 const s=createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const port=s.address().port;
  s.close(()=>resolve(port));});
});
const executable=fileURLToPath(new URL(
 '../apps/mikoshi_reconciliation/service.mjs',import.meta.url));
const proc=spawn(process.execPath,[executable],{stdio:'ignore',env:{
 ...process.env,ADA_CAPS:'reconciliation.inspect',
 ADA_INTERNAL_KEY:key,APP_PORT:String(port)}});
const base='http://127.0.0.1:'+port;
try{
 let ready=false;
 for(let i=0;i<90;i++){
  await new Promise(done=>setTimeout(done,35));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
 }
 assert(ready);
 assert.equal((await fetch(base+'/graph')).status,401);
 const manifest=JSON.parse(await readFile(
  new URL('../apps/mikoshi_reconciliation/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest));
 assert(graph.nodes.some(x=>x.skill?.domain==='source-reconciliation'));
 const sample={rows:[{pairIndex:0,motif:{applied:false},
  grounding:{applied:false}}],expiresAt:Date.now()+50000};
 const res=await fetch(base+'/invoke',{method:'POST',
  headers:{'x-internal-key':key,'content-type':'application/json'},
  body:JSON.stringify({action:'mikoshi_reconciliation.assess',params:sample})});
 assert.equal(res.status,200);
 const doc=await res.json();
 assert.equal(doc.result.counts.missingBoth,1);
 assert.equal(doc.result.safeAutomaticWrites,false);
 const unauthorized=await fetch(base+'/invoke',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'mikoshi_reconciliation.assess',params:sample})});
 assert.equal(unauthorized.status,401);
 console.log('MIKOSHI_RECONCILIATION_SERVICE_OK authenticated independent read-only MAS');
}finally{proc.kill();}
