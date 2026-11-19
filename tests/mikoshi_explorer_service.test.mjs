import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
const m=JSON.parse(await readFile(new URL('../apps/mikoshi_explorer/manifest.json',import.meta.url)));
const key=randomBytes(32).toString('hex');
const dir=await mkdtemp(join(tmpdir(),'mikoshi-explorer-')),file=join(dir,'state.json');
const exe=fileURLToPath(new URL('../apps/mikoshi_explorer/service.mjs',import.meta.url));
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});
async function launch(caps){
 const p=await port(),base='http://127.0.0.1:'+p;
 const child=spawn(process.execPath,[exe],{stdio:'ignore',
  env:{...process.env,APP_PORT:String(p),ADA_INTERNAL_KEY:key,
   ADA_CAPS:caps,MIKOSHI_EXPLORER_STATE:file}});
 let alive=false;
 for(let i=0;i<85;i++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){alive=true;break;}}catch{}
 }
 assert(alive,'service not ready');
 const call=async(action,params={},auth=true)=>{
  const res=await fetch(base+'/invoke',{method:'POST',
   headers:{'content-type':'application/json',
    ...(auth?{'x-internal-key':key}:{})},body:JSON.stringify({action,params})});
  return {status:res.status,body:await res.json()};
 };
 return {child,base,call};
}
let live;
try{
 live=await launch('exploration.inspect,exploration.learn');
 assert.equal((await fetch(live.base+'/graph')).status,401);
 const graph=await (await fetch(live.base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,m));
 assert(graph.nodes.some(n=>n.id==='mikoshi_explorer.begin'));
 assert.equal((await live.call('mikoshi_explorer.begin',{ids:['m00001','m00002'],
  budget:4})).status,400,'training must require approval');
 assert.equal((await live.call('mikoshi_explorer.status',{},false)).status,401);
 const started=await live.call('mikoshi_explorer.begin',{ids:['m00001','m00002'],
  budget:4,sourceApproved:true});
 assert.equal(started.status,200);
 const sid=started.body.result.session.id;
 const plan=await live.call('mikoshi_explorer.choose');
 assert.equal(plan.body.result.action,'inspect');
 const value={...plan.body.result,loss:.3,sourceApproved:true};
 const parallel=await Promise.all([
  live.call('mikoshi_explorer.feedback',value),
  live.call('mikoshi_explorer.feedback',value)]);
 assert.equal(parallel.filter(x=>x.status===200).length,1);
 const state=JSON.parse(await readFile(file,'utf8'));
 assert.equal(state.session.step,1);
 assert(!JSON.stringify(state).includes('samples'));
 live.child.kill();live=null;
 live=await launch('exploration.inspect');
 const limited=await (await fetch(live.base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(limited,m));
 assert(!limited.nodes.some(n=>n.id==='mikoshi_explorer.feedback'));
 assert.equal((await live.call('mikoshi_explorer.feedback',value)).status,400);
 assert.equal((await live.call('mikoshi_explorer.status')).body.result.session.step,1);
 live.child.kill();live=null;
 live=await launch('exploration.inspect,exploration.learn');
 assert.equal((await live.call('mikoshi_explorer.stop',{
  sessionId:sid,sourceApproved:true})).status,200);
 assert.equal((await live.call('mikoshi_explorer.choose')).body.result.ready,false);
 console.log('MIKOSHI_EXPLORER_SERVICE_OK private state, replay, auth, read-only restart');
}finally{live?.child.kill();await rm(dir,{recursive:true,force:true});}
