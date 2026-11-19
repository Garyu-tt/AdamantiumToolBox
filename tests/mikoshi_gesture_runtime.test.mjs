import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {validateGraph} from '../core/contract.mjs';
const specs=[
 {id:'mikoshi_gestures',caps:'gesture.inspect,gesture.plan'},
 {id:'mikoshi_vocalstream',caps:'waveform.inspect,waveform.render'}];
const key=randomBytes(32).toString('hex'),running=[];
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});
async function start(spec){
 const p=await port(),base='http://127.0.0.1:'+p;
 const entry=fileURLToPath(new URL('../apps/'+spec.id+'/service.mjs',import.meta.url));
 const proc=spawn(process.execPath,[entry],{stdio:'ignore',env:{
  ...process.env,ADA_INTERNAL_KEY:key,ADA_CAPS:spec.caps,APP_PORT:String(p)}});
 running.push(proc);let up=false;
 for(let t=0;t<70;t++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){up=true;break;}}catch{}
 }
 assert(up,spec.id+' service must start alone');
 const request=(action,params={},auth=true)=>fetch(base+'/invoke',{
  method:'POST',headers:{'content-type':'application/json',
   ...(auth?{'x-internal-key':key}:{})},body:JSON.stringify({action,params})});
 const manifest=JSON.parse(await readFile(new URL(
  '../apps/'+spec.id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest));
 assert.equal((await fetch(base+'/graph')).status,401);
 return {request,graph,proc,base};
}
try{
 const wave=await start(specs[1]);
 assert(wave.graph.nodes.some(n=>n.id==='mikoshi_vocalstream.render'),
  'wave renderer must run alone without gesture planner');
 const gesture=await start(specs[0]);
 const raw=await gesture.request('mikoshi_gestures.plan',{steps:[
  {motor:{f1:810,f2:1290},durationMs:200,pauseMs:130},
  {motor:{f1:300,f2:2450},durationMs:250}]});
 assert.equal(raw.status,200);
 const planned=(await raw.json()).result;
 assert.equal(planned.durationMs,580);
 const res=await wave.request('mikoshi_vocalstream.render',{trajectory:planned});
 assert.equal(res.status,200);
 const voice=(await res.json()).result;
 assert.equal(voice.durationMs,580);
 assert.equal(voice.sampleRate,12000);
 assert.equal(Buffer.from(voice.audioBase64,'base64').subarray(0,4).toString(),'RIFF');
 assert.equal((await gesture.request('mikoshi_gestures.plan',{},false)).status,401);
 assert.equal((await wave.request('mikoshi_vocalstream.render',{},false)).status,401);
 assert.equal((await wave.request('mikoshi_vocalstream.render',
  {trajectory:{...planned,frames:[]}})).status,400);
 gesture.proc.kill();running.pop();
 const restricted=await start({...specs[0],caps:'gesture.inspect'});
 assert(!restricted.graph.nodes.some(n=>n.id==='mikoshi_gestures.plan'));
 assert.equal((await restricted.request('mikoshi_gestures.plan',{steps:[]})).status,400);
 console.log('MIKOSHI_GESTURE_RUNTIME_OK isolated MAS, permissions, render composition');
}finally{for(const p of running)p.kill();}
