import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
const m=JSON.parse(await readFile(new URL('../apps/mikoshi_sequences/manifest.json',import.meta.url)));
const secret=randomBytes(32).toString('hex'),folder=await mkdtemp(join(tmpdir(),'mikoshi-sequence-'));
const stateFile=join(folder,'state.json'),service=fileURLToPath(new URL(
 '../apps/mikoshi_sequences/service.mjs',import.meta.url));
function choosePort(){return new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});}
async function start(caps){
 const port=await choosePort(),url='http://127.0.0.1:'+port;
 const worker=spawn(process.execPath,[service],{stdio:'ignore',env:{...process.env,
  ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,APP_PORT:String(port),
  MIKOSHI_SEQUENCE_STATE:stateFile}});
 let up=false;
 for(let t=0;t<80;t++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(url+'/health')).ok){up=true;break;}}catch{}
 }
 assert(up,'standalone MAS service failed to start');
 const graph=()=>fetch(url+'/graph',{headers:{'x-internal-key':secret}});
 const call=(action,params={},auth=true)=>fetch(url+'/invoke',{method:'POST',
  headers:{'content-type':'application/json',...(auth?{'x-internal-key':secret}:{})},
  body:JSON.stringify({action,params})});
 return {worker,url,graph,call};
}
const A='m00001',B='m00002',C='m00003';
const events=[{id:A,gapMs:0},{id:B,gapMs:210},{id:C,gapMs:290}];
let live;
try{
 live=await start('sequence.inspect,sequence.learn');
 assert.equal((await fetch(live.url+'/graph')).status,401);
 const g=await (await live.graph()).json();assert(validateGraph(g,m));
 assert(g.nodes.some(n=>n.id==='mikoshi_sequences.teach'));
 assert.equal((await live.call('mikoshi_sequences.teach',{events})).status,400);
 assert.equal((await live.call('mikoshi_sequences.status',{},false)).status,401);
 const valid={events,sourceApproved:true};
 const one=await live.call('mikoshi_sequences.teach',valid);
 assert.equal(one.status,200);
 const both=await Promise.all([live.call('mikoshi_sequences.teach',valid),
  live.call('mikoshi_sequences.teach',valid)]);
 assert(both.every(r=>r.status===200));
 const predicted=(await (await live.call('mikoshi_sequences.predict',
  {context:events.slice(0,2)})).json()).result;
 assert.equal(predicted.candidates[0].nextId,C);
 const state=JSON.parse(await readFile(stateFile,'utf8'));
 assert.equal(state.episodes,3);
 assert.equal(state.observations,9);
 assert(!JSON.stringify(state).includes('audioBase64'));
 live.worker.kill();live=null;
 live=await start('sequence.inspect');
 const readonly=await (await live.graph()).json();assert(validateGraph(readonly,m));
 assert(!readonly.nodes.some(n=>n.id==='mikoshi_sequences.teach'));
 assert.equal((await live.call('mikoshi_sequences.teach',valid)).status,400);
 const status=(await (await live.call('mikoshi_sequences.status')).json()).result;
 assert.equal(status.episodes,3);
 console.log('MIKOSHI_SEQUENCES_SERVICE_OK auth, denied writes, concurrency, restart');
}finally{live?.worker.kill();await rm(folder,{force:true,recursive:true});}
