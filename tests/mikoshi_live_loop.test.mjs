import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
import {practice} from '../apps/mikoshi_classroom/loop_engine.js';
// Eight real MAS services, no direct algorithm calls inside the composition.
const specs=[
 ['mikoshi_phonetics','phonetics.inspect,phonetics.render'],
 ['mikoshi_motifs','motifs.inspect,motifs.learn'],
 ['mikoshi_motorlinks','motor.inspect,motor.learn'],
 ['mikoshi_sequences','sequence.inspect,sequence.learn'],
 ['mikoshi_gestures','gesture.inspect,gesture.plan'],
 ['mikoshi_vocalstream','waveform.inspect,waveform.render'],
 ['mikoshi_audiometry','audiometry.inspect,audiometry.compare'],
 ['mikoshi_transitions','transition.inspect,transition.learn']
];
const domains={articulation:['articulation',['preview','observe']],
 memory:['auditory-memory',['remember']],
 motor:['motor-learning',['propose','feedback','status']],
 sequence:['auditory-sequence',['teach']],
 gesture:['gesture-planner',['plan']],
 wave:['waveform-renderer',['render']],
 audiometry:['acoustic-feedback',['compare']],
 transition:['transition-learning',['propose','feedback','status']]};
const key=randomBytes(32).toString('hex'),running=[];
const dir=await mkdtemp(join(tmpdir(),'mikoshi-live-loop-'));
const files={MIKOSHI_PHONETICS_STATE:'phonetics.json',
 MIKOSHI_MOTIFS_STATE:'motifs.json',MIKOSHI_MOTOR_STATE:'motors.json',
 MIKOSHI_SEQUENCE_STATE:'sequences.json',
 MIKOSHI_TRANSITIONS_STATE:'transitions.json'};
const ports=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});
});
const actions=new Map(),nodes=[];
async function launch(spec){
 const [id,caps]=spec,port=await ports(),base='http://127.0.0.1:'+port;
 const entry=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
 const states=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,join(dir,v)]));
 const proc=spawn(process.execPath,[entry],{stdio:'ignore',
  env:{...process.env,...states,ADA_INTERNAL_KEY:key,
   ADA_CAPS:caps,APP_PORT:String(port)}});
 running.push(proc);
 let ready=false;
 for(let n=0;n<100;n++){
  await new Promise(ok=>setTimeout(ok,40));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
 }
 assert(ready,id+' did not boot');
 const manifest=JSON.parse(await readFile(new URL('../apps/'+id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest),id+' invalid graph');
 for(const n of graph.nodes){
  nodes.push(n);
  if(n.type==='action'){
   assert(!actions.has(n.id),'duplicate action '+n.id);actions.set(n.id,base);
  }
 }
}
async function invoke(action,params={}){
 const base=actions.get(action);
 if(!base)throw Error('action_not_advertised_'+action);
 const res=await fetch(base+'/invoke',{method:'POST',
  headers:{'content-type':'application/json','x-internal-key':key},
  body:JSON.stringify({action,params})});
 const doc=await res.json();
 if(!res.ok)throw Error(action+'_http_'+res.status+'_'+doc.error);
 return doc.result;
}
try{
 for(const spec of specs)await launch(spec);
 const skills={};
 for(const [role,[domain,needed]] of Object.entries(domains)){
  const provider=nodes.find(n=>n.type==='resource'&&
   n.skill?.schema==='mikoshi.skill.v1'&&n.skill.domain===domain&&
   needed.every(name=>actions.has(n.skill.actions?.[name])));
  assert(provider,'missing live skill '+role);
  skills[role]=Object.fromEntries(needed.map(k=>[k,provider.skill.actions[k]]));
 }
 let calls=0,progress=[];
 const api={call:async(action,params)=>{calls++;return invoke(action,params);}};
 await assert.rejects(practice(api,{...skills,transition:null}),/missing_capability_transition_propose/);
 assert.equal(calls,0,'preflight must not mutate any app');
 const first=await practice(api,skills,msg=>progress.push(msg));
 assert.equal(first.schema,'mikoshi.learning.loop.v1');
 assert.equal(first.languageModel,false);
 assert.equal(first.transitionMs,120);
 assert.equal(first.transitionLoss,0);
 assert.notEqual(first.motifs[0],first.motifs[1]);
 assert.equal(Buffer.from(first.audioBase64,'base64').toString('ascii',0,4),'RIFF');
 const motors=JSON.parse(await readFile(join(dir,files.MIKOSHI_MOTOR_STATE),'utf8'));
 const sequence=JSON.parse(await readFile(join(dir,files.MIKOSHI_SEQUENCE_STATE),'utf8'));
 const transitions=JSON.parse(await readFile(join(dir,files.MIKOSHI_TRANSITIONS_STATE),'utf8'));
 assert.equal(motors.records.length,2);
 assert.equal(sequence.episodes,1);
 assert.equal(transitions.pairs[0].trials,7);
 assert.equal(transitions.pairs[0].bestMs,120);
 assert(!JSON.stringify(motors).includes('audioBase64'));
 assert(!JSON.stringify(transitions).includes('audioBase64'));
 assert(calls>=65&&progress.length>=10);
 const again=await practice(api,skills);
 assert.equal(again.transitionMs,120,'previously learned join must remain usable');
 assert.equal((await invoke(skills.transition.status)).pairs[0].trials,7);
 console.log('MIKOSHI_LIVE_LOOP_OK eight real MAS services, reward, persistence, retry');
}finally{
 for(const p of running)p.kill();
 await rm(dir,{force:true,recursive:true});
}
