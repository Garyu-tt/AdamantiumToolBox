import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
const m=JSON.parse(await readFile(new URL('../apps/mikoshi_motorlinks/manifest.json',import.meta.url)));
const secret=randomBytes(32).toString('hex'),folder=await mkdtemp(join(tmpdir(),'mikoshi-motor-'));
const stateFile=join(folder,'private.json');
const entry=fileURLToPath(new URL('../apps/mikoshi_motorlinks/service.mjs',import.meta.url));
const port=()=>new Promise((resolve,reject)=>{
 const s=createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const v=s.address().port;s.close(()=>resolve(v));});
});
async function start(caps){
 const p=await port(),base='http://127.0.0.1:'+p;
 const process=spawn(globalThis.process.execPath,[entry],{stdio:'ignore',env:{
  ...globalThis.process.env,ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,
  MIKOSHI_MOTOR_STATE:stateFile,APP_PORT:String(p)}});
 let ready=false;
 for(let k=0;k<80;k++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
 }
 assert(ready,'motor service unavailable');
 const call=(action,params={},auth=true)=>fetch(base+'/invoke',{method:'POST',
  headers:{'content-type':'application/json',...(auth?{'x-internal-key':secret}:{})},
  body:JSON.stringify({action,params})});
 return {process,base,call};
}
let live;
try{
 live=await start('motor.inspect,motor.learn');
 assert.equal((await fetch(live.base+'/graph')).status,401);
 const graph=await (await fetch(live.base+'/graph',{headers:{'x-internal-key':secret}})).json();
 assert(validateGraph(graph,m));assert(graph.nodes.some(x=>x.id==='mikoshi_motorlinks.feedback'));
 const prop=(await (await live.call('mikoshi_motorlinks.propose',{id:'m00001'})).json()).result;
 assert(prop.ready);
 assert.equal((await live.call('mikoshi_motorlinks.feedback',
  {...prop,loss:.5})).status,400,'consent gate');
 const payload={id:prop.id,candidate:prop.candidate,trial:prop.trial,
  loss:.5,sourceApproved:true};
 const concurrent=await Promise.all([live.call('mikoshi_motorlinks.feedback',payload),
  live.call('mikoshi_motorlinks.feedback',payload)]);
 assert.equal(concurrent.filter(r=>r.status===200).length,1,'stale trial fails closed');
 const saved=JSON.parse(await readFile(stateFile,'utf8'));
 assert.equal(saved.records[0].trials,1);
 assert(!JSON.stringify(saved).includes('audioBase64'));
 assert.equal((await live.call('mikoshi_motorlinks.status',{},false)).status,401);
 live.process.kill();live=null;
 live=await start('motor.inspect');
 const readonly=await (await fetch(live.base+'/graph',{
  headers:{'x-internal-key':secret}})).json();
 assert(validateGraph(readonly,m));
 assert(!readonly.nodes.some(x=>x.id==='mikoshi_motorlinks.feedback'));
 assert.equal((await live.call('mikoshi_motorlinks.feedback',payload)).status,400);
 const catalog=(await (await live.call('mikoshi_motorlinks.status')).json()).result;
 assert.equal(catalog.records[0].trials,1);
 console.log('MIKOSHI_MOTORLINKS_SERVICE_OK authorized, serialized, persisted, readonly');
}finally{live?.process.kill();await rm(folder,{recursive:true,force:true});}
