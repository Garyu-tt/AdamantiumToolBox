import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
import {explore} from '../apps/mikoshi_classroom/explore_engine.js';
const specs=[
 ['mikoshi_phonetics','phonetics.inspect,phonetics.render'],
 ['mikoshi_motifs','motifs.inspect,motifs.learn'],
 ['mikoshi_motorlinks','motor.inspect,motor.learn'],
 ['mikoshi_explorer','exploration.inspect,exploration.learn']
];
const domains={articulation:['articulation',['preview','observe']],
 memory:['auditory-memory',['remember']],
 motor:['motor-learning',['propose','feedback','status']],
 explorer:['exploration',['begin','choose','feedback','stop','status']]};
const key=randomBytes(32).toString('hex'),children=[];
const directory=await mkdtemp(join(tmpdir(),'mikoshi-explore-live-'));
const state={MIKOSHI_MOTIFS_STATE:join(directory,'motifs.json'),
 MIKOSHI_MOTOR_STATE:join(directory,'motor.json'),
 MIKOSHI_EXPLORER_STATE:join(directory,'explorer.json')};
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});
const nodes=[],actions=new Map();
async function start([id,caps]){
 const p=await port(),base='http://127.0.0.1:'+p;
 const entry=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
 const child=spawn(process.execPath,[entry],{stdio:'ignore',env:{
  ...process.env,...state,ADA_INTERNAL_KEY:key,ADA_CAPS:caps,APP_PORT:String(p)}});
 children.push(child);let up=false;
 for(let i=0;i<90;i++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){up=true;break;}}catch{}
 }
 assert(up,id+' failed to start');
 assert.equal((await fetch(base+'/graph')).status,401);
 const m=JSON.parse(await readFile(new URL('../apps/'+id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,m));
 for(const node of graph.nodes){
  nodes.push(node);
  if(node.type==='action')actions.set(node.id,base);
 }
}
async function call(action,params={}){
 const base=actions.get(action);assert(base,'missing authorized action: '+action);
 const res=await fetch(base+'/invoke',{method:'POST',headers:{
  'content-type':'application/json','x-internal-key':key},
  body:JSON.stringify({action,params})});
 const doc=await res.json();
 if(!res.ok)throw Error(action+':'+res.status+':'+doc.error);
 return doc.result;
}
try{
 for(const spec of specs)await start(spec);
 const skills={};
 for(const [role,[domain,methods]] of Object.entries(domains)){
  const provider=nodes.find(n=>n.type==='resource'&&
   n.skill?.schema==='mikoshi.skill.v1'&&n.skill.domain===domain&&
   methods.every(x=>actions.has(n.skill.actions?.[x])));
  assert(provider,'missing capability '+domain);
  skills[role]=Object.fromEntries(methods.map(x=>[x,provider.skill.actions[x]]));
 }
 const lesson=[];
 for(const motor of [{f1:810,f2:1290},{f1:300,f2:2450}]){
  const teacher=await call(skills.articulation.preview,{motor});
  const record=await call(skills.memory.remember,{
   samples:teacher.samples,sampleRate:12000,sourceApproved:true});
  lesson.push({id:record.id,samples:teacher.samples});
 }
 assert.notEqual(lesson[0].id,lesson[1].id);
 const api={call};let logs=[];
 await assert.rejects(explore(api,{...skills,motor:{}},lesson,6),
  /missing_capability_motor_propose/);
 const result=await explore(api,skills,lesson,6,s=>logs.push(s));
 assert.equal(result.schema,'mikoshi.exploration.result.v1');
 assert.equal(result.status,'complete');
 assert.equal(result.languageModel,false);
 assert.equal(result.decisions.length,6);
 assert.deepEqual(result.decisions.slice(0,2).map(x=>x.action),
  ['inspect','inspect']);
 assert(result.decisions.some(x=>x.action==='practice'));
 const explored=JSON.parse(await readFile(state.MIKOSHI_EXPLORER_STATE,'utf8'));
 const motor=JSON.parse(await readFile(state.MIKOSHI_MOTOR_STATE,'utf8'));
 assert.equal(explored.session.step,6);
 assert(motor.records.length>=1);
 assert(!JSON.stringify(explored).includes('samples'));
 assert(!JSON.stringify(motor).includes('samples'));
 assert(logs.length===6);
 assert.equal((await call(skills.explorer.choose)).ready,false);
 console.log('MIKOSHI_EXPLORER_LIVE_OK four MAS services, adaptive practice, persistence');
}finally{for(const child of children)child.kill();
 await rm(directory,{recursive:true,force:true});}
