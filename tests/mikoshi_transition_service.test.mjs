import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateGraph} from '../core/contract.mjs';
import {plan} from '../apps/mikoshi_gestures/planner.mjs';
import {render,wav} from '../apps/mikoshi_vocalstream/renderer.mjs';
const baseDir=await mkdtemp(join(tmpdir(),'mikoshi-r08-'));
const key=randomBytes(32).toString('hex'),stateFile=join(baseDir,'transitions.json');
const apps=[
 {id:'mikoshi_audiometry',caps:'audiometry.inspect,audiometry.compare'},
 {id:'mikoshi_transitions',caps:'transition.inspect,transition.learn'}];
const processes=[];
const freePort=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});
});
async function start(app){
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const proc=spawn(process.execPath,[fileURLToPath(new URL(
  '../apps/'+app.id+'/service.mjs',import.meta.url))],{stdio:'ignore',env:{
   ...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:key,ADA_CAPS:app.caps,
   MIKOSHI_TRANSITIONS_STATE:stateFile}});
 processes.push(proc);
 let ready=false;
 for(let i=0;i<80;i++){await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}}
 assert(ready,'isolated MAS must boot '+app.id);
 const manifest=JSON.parse(await readFile(new URL('../apps/'+app.id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest));
 const call=(action,params={},authorized=true)=>fetch(base+'/invoke',{method:'POST',
  headers:{'content-type':'application/json',...(authorized?{'x-internal-key':key}:{})},
  body:JSON.stringify({action,params})});
 return {proc,graph,base,call};
}
try{
 const compare=await start(apps[0]),learn=await start(apps[1]);
 assert.equal((await fetch(compare.base+'/graph')).status,401);
 assert.equal((await fetch(learn.base+'/graph')).status,401);
 const steps=[{motor:{f1:810,f2:1290},durationMs:240},
  {motor:{f1:300,f2:2450},durationMs:260}];
 const ref=wav(render(plan(steps,120)));
 let proposal=(await (await learn.call('mikoshi_transitions.propose',
  {from:'m00001',to:'m00002'})).json()).result;
 assert.equal(proposal.transitionMs,80);
 let sample=wav(render(plan(steps,proposal.transitionMs)));
 const evaluation=(await (await compare.call('mikoshi_audiometry.compare',
  {reference:ref,candidate:sample})).json()).result;
 assert(evaluation.loss>0);
 const payload={from:proposal.from,to:proposal.to,trials:proposal.trials,
  transitionMs:proposal.transitionMs,loss:evaluation.loss,sourceApproved:true};
 assert.equal((await learn.call('mikoshi_transitions.feedback',
  {...payload,sourceApproved:false})).status,400);
 const simultaneous=await Promise.all([learn.call('mikoshi_transitions.feedback',payload),
  learn.call('mikoshi_transitions.feedback',payload)]);
 assert.equal(simultaneous.filter(x=>x.ok).length,1,'duplicate reward is stale');
 const data=JSON.parse(await readFile(stateFile,'utf8'));
 assert.equal(data.pairs.length,1);assert.equal(data.pairs[0].trials,1);
 assert(!JSON.stringify(data).includes('audioBase64'));
 assert.equal((await compare.call('mikoshi_audiometry.compare',{},false)).status,401);
 assert.equal((await learn.call('mikoshi_transitions.status',{},false)).status,401);
 learn.proc.kill();const readonly=await start({...apps[1],caps:'transition.inspect'});
 assert(!readonly.graph.nodes.some(n=>n.id==='mikoshi_transitions.feedback'));
 assert.equal((await readonly.call('mikoshi_transitions.feedback',payload)).status,400);
 const status=(await (await readonly.call('mikoshi_transitions.status')).json()).result;
 assert.equal(status.pairs[0].trials,1);
 console.log('MIKOSHI_TRANSITIONS_SERVICE_OK authorization, serialized reward, restart');
}finally{for(const p of processes)p.kill();await rm(baseDir,{recursive:true,force:true});}
