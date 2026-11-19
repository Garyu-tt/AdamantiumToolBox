import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
import {testHypothesis} from '../apps/mikoshi_classroom/hypotheses_engine.js';
const specs=[
 ['mikoshi_hypotheses','hypothesis.inspect,hypothesis.propose'],
 ['mikoshi_worldmodel','prediction.inspect,prediction.learn'],
 ['mikoshi_phonetics','phonetics.inspect,phonetics.render']
];
const required={hypothesis:['hypothesis-search',['generate','rank']],
 world:['world-prediction',['estimate','forecast','observe','status','abort']],
 articulation:['articulation',['preview','observe']]};
const key=randomBytes(32).toString('hex'),children=[],nodes=[],endpoints=new Map();
const dir=await mkdtemp(join(tmpdir(),'mikoshi-hypothesis-live-'));
const file=join(dir,'world.json');
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});
async function launch([id,caps]){
 const p=await port(),base='http://127.0.0.1:'+p;
 const exe=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
 const child=spawn(process.execPath,[exe],{stdio:'ignore',env:{
  ...process.env,ADA_INTERNAL_KEY:key,ADA_CAPS:caps,APP_PORT:String(p),
  MIKOSHI_WORLD_STATE:file}});
 children.push(child);let ready=false;
 for(let i=0;i<90;i++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
 }
 assert(ready,id+' failed to start');
 assert.equal((await fetch(base+'/graph')).status,401);
 const manifest=JSON.parse(await readFile(new URL(
  '../apps/'+id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest));
 for(const node of graph.nodes){
  nodes.push(node);
  if(node.type==='action')endpoints.set(node.id,base);
 }
}
async function call(action,params={}){
 const base=endpoints.get(action);assert(base,'capability not registered '+action);
 const res=await fetch(base+'/invoke',{method:'POST',
  headers:{'content-type':'application/json','x-internal-key':key},
  body:JSON.stringify({action,params})});
 const data=await res.json();
 if(!res.ok)throw Error(action+':'+res.status+':'+data.error);
 return data.result;
}
try{
 for(const spec of specs)await launch(spec);
 const skills={};
 for(const [role,[domain,methods]] of Object.entries(required)){
  const node=nodes.find(n=>n.type==='resource'&&
   n.skill?.schema==='mikoshi.skill.v1'&&n.skill.domain===domain&&
   methods.every(x=>endpoints.has(n.skill.actions?.[x])));
  assert(node,'missing live skill '+domain);
  skills[role]=Object.fromEntries(methods.map(x=>[x,node.skill.actions[x]]));
 }
 let invocations=0;
 const api={call:async(...args)=>{invocations++;return call(...args);}};
 await assert.rejects(testHypothesis(api,{...skills,world:{}},
  {f1:560,f2:1640}),/missing_capability_world_estimate/);
 assert.equal(invocations,0,'preflight must run before writes');
 const progress=[];
 const first=await testHypothesis(api,skills,{f1:560,f2:1640},
  s=>progress.push(s));
 assert.equal(first.schema,'mikoshi.hypothesis.experiment.v1');
 assert.equal(first.languageModel,false);
 assert.equal(first.forecastAvailable,false);
 assert.equal(first.observed,false);
 assert.equal(Buffer.from(first.audioBase64,'base64').toString('ascii',0,4),'RIFF');
 const second=await testHypothesis(api,skills,{f1:560,f2:1640});
 assert.equal(second.forecastAvailable,true);
 assert.equal(second.observed,true);
 assert.notDeepEqual(first.motor,second.motor,'novelty should shift experiments');
 const stored=JSON.parse(await readFile(file,'utf8'));
 assert.equal(stored.observations,2);
 assert.equal(stored.pending,null);
 assert.equal(stored.examples.length,2);
 assert(!JSON.stringify(stored).includes('audioBase64'));
 assert(progress.length>=2);
 const status=await call(skills.world.status);
 assert.equal(status.observations,2);
 console.log('MIKOSHI_HYPOTHESES_LIVE_OK three real MAS services, novel action tests');
}finally{for(const c of children)c.kill();await rm(dir,{recursive:true,force:true});}
