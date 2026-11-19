import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
const secret=randomBytes(32).toString('hex');
const folder=await mkdtemp(join(tmpdir(),'mikoshi-motifs-'));
const stateFile=join(folder,'private.json');
const service=fileURLToPath(new URL('../apps/mikoshi_motifs/service.mjs',import.meta.url));
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>ok(n));});
});
async function launch(caps){
 const p=await port(),base='http://127.0.0.1:'+p;
 const worker=spawn(process.execPath,[service],{stdio:'ignore',env:{...process.env,
  APP_PORT:String(p),ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,
  MIKOSHI_MOTIFS_STATE:stateFile}});
 let ready=false;
 for(let n=0;n<70;n++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
 }
 assert(ready,'service must start in isolation');
 const request=(action,params,auth=true)=>fetch(base+'/invoke',{method:'POST',
  headers:{'content-type':'application/json',...(auth?{'x-internal-key':secret}:{})},
  body:JSON.stringify({action,params})});
 return {worker,base,request};
}
const samples=Array.from({length:2400},(_,i)=>Math.sin(2*Math.PI*235*i/12000)*.32);
let worker;
try{
 const a=await launch('motifs.inspect,motifs.learn');worker=a.worker;
 assert.equal((await fetch(a.base+'/graph')).status,401);
 const graph=await (await fetch(a.base+'/graph',{
  headers:{'x-internal-key':secret}})).json();
 assert(graph.nodes.some(n=>n.id==='mikoshi_motifs.remember'));
 const forbidden=await a.request('mikoshi_motifs.remember',{samples,sampleRate:12000});
 assert.equal(forbidden.status,400);
 let learned=await a.request('mikoshi_motifs.remember',{
  samples,sampleRate:12000,sourceApproved:true});
 assert.equal(learned.status,200);
 const result=(await learned.json()).result;
 assert.equal(result.kind,'discovered');
 assert.equal((await a.request('mikoshi_motifs.remember',{samples,sampleRate:12000,
  sourceApproved:true})).status,200);
 const recognized=await a.request('mikoshi_motifs.recognize',{samples,sampleRate:12000});
 assert.equal((await recognized.json()).result.id,result.id);
 const saved=JSON.parse(await readFile(stateFile,'utf8'));
 assert.equal(saved.heard,2);
 assert(!('samples' in saved.units[0]));
 assert.equal((await a.request('mikoshi_motifs.status',{},false)).status,401);
 a.worker.kill();worker=null;
 const b=await launch('motifs.inspect');worker=b.worker;
 const readonly=await (await fetch(b.base+'/graph',{headers:{'x-internal-key':secret}})).json();
 assert(!readonly.nodes.some(n=>n.id==='mikoshi_motifs.remember'));
 assert.equal((await b.request('mikoshi_motifs.remember',{
  samples,sampleRate:12000,sourceApproved:true})).status,400);
 const catalog=(await (await b.request('mikoshi_motifs.status',{})).json()).result;
 assert.equal(catalog.heard,2);
 console.log('MIKOSHI_MOTIFS_SERVICE_OK persistence, isolation, denial, no PCM retention');
}finally{worker?.kill();await rm(folder,{recursive:true,force:true});}
