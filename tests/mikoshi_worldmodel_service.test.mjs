import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {spectrum} from '../apps/mikoshi_phonetics/spectrum.mjs';
const m=JSON.parse(await readFile(new URL('../apps/mikoshi_worldmodel/manifest.json',import.meta.url)));
const key=randomBytes(32).toString('hex'),dir=await mkdtemp(join(tmpdir(),'mikoshi-model-'));
const file=join(dir,'private.json'),exe=fileURLToPath(
 new URL('../apps/mikoshi_worldmodel/service.mjs',import.meta.url));
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});
async function launch(caps){
 const p=await port(),base='http://127.0.0.1:'+p;
 const child=spawn(process.execPath,[exe],{stdio:'ignore',env:{
  ...process.env,ADA_INTERNAL_KEY:key,ADA_CAPS:caps,APP_PORT:String(p),
  MIKOSHI_WORLD_STATE:file}});
 let up=false;
 for(let i=0;i<85;i++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){up=true;break;}}catch{}
 }
 assert(up,'model service unavailable');
 const call=async(action,params={},authorized=true)=>{
  const res=await fetch(base+'/invoke',{method:'POST',headers:{
   'content-type':'application/json',...(authorized?{'x-internal-key':key}:{})},
   body:JSON.stringify({action,params})});
  return {status:res.status,data:await res.json()};
 };
 return {child,base,call};
}
let live;
try{
 live=await launch('prediction.inspect,prediction.learn');
 assert.equal((await fetch(live.base+'/graph')).status,401);
 const graph=await (await fetch(live.base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,m));
 assert(graph.nodes.some(n=>n.id==='mikoshi_worldmodel.forecast'));
 const a={f1:560,f2:1640},b={f1:700,f2:1880};
 assert.equal((await live.call('mikoshi_worldmodel.forecast',{motor:a})).status,400);
 const begin=await live.call('mikoshi_worldmodel.forecast',{
  motor:a,sourceApproved:true});
 assert.equal(begin.status,200);assert.equal(begin.data.result.ready,false);
 const ticket=begin.data.result.ticket;
 assert.equal((await live.call('mikoshi_worldmodel.forecast',{
  motor:b,sourceApproved:true})).status,400);
 assert.equal((await live.call('mikoshi_worldmodel.observe',{
  ticket:'invalid',vector:spectrum(synth(a)),sourceApproved:true})).status,400);
 const learned=await live.call('mikoshi_worldmodel.observe',{
  ticket,vector:spectrum(synth(a)),sourceApproved:true});
 assert.equal(learned.status,200);
 assert.equal((await live.call('mikoshi_worldmodel.observe',{
  ticket,vector:spectrum(synth(a)),sourceApproved:true})).status,400);
 const estimated=await live.call('mikoshi_worldmodel.estimate',{motor:b});
 assert.equal(estimated.data.result.ready,true);
 const interrupted=await live.call('mikoshi_worldmodel.forecast',{
  motor:b,sourceApproved:true});
 assert.equal(interrupted.status,200);
 const abandoned=interrupted.data.result.ticket;
 const recover=await live.call('mikoshi_worldmodel.abort',{
  ticket:abandoned,sourceApproved:true});
 assert.equal(recover.status,200);
 assert.equal(recover.data.result.pendingTicket,null);
 assert.equal((await live.call('mikoshi_worldmodel.observe',{
  ticket:abandoned,vector:spectrum(synth(b)),sourceApproved:true})).status,400);
 const state=JSON.parse(await readFile(file,'utf8'));
 assert.equal(state.observations,1);assert.equal(state.pending,null);
 assert(!JSON.stringify(state).includes('audioBase64'));
 assert.equal((await live.call('mikoshi_worldmodel.status',{},false)).status,401);
 live.child.kill();live=null;
 live=await launch('prediction.inspect');
 const readonly=await (await fetch(live.base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(readonly,m));
 assert(!readonly.nodes.some(n=>n.id==='mikoshi_worldmodel.observe'));
 assert.equal((await live.call('mikoshi_worldmodel.forecast',{
  motor:b,sourceApproved:true})).status,400);
 assert.equal((await live.call('mikoshi_worldmodel.status')).data.result.observations,1);
 console.log('MIKOSHI_WORLDMODEL_SERVICE_OK pre-action ticket, persistence and auth');
}finally{live?.child.kill();await rm(dir,{recursive:true,force:true});}
