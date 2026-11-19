import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
const repo=[
 ['mikoshi_segments','segments.observe'],
 ['mikoshi_motifs','motifs.inspect,motifs.learn'],
 ['mikoshi_sequences','sequence.inspect,sequence.learn']
];
const secret=randomBytes(32).toString('hex'),running=[];
const dir=await mkdtemp(join(tmpdir(),'mikoshi-stream-'));
const state={MIKOSHI_MOTIFS_STATE:join(dir,'motifs.json'),
 MIKOSHI_SEQUENCE_STATE:join(dir,'sequence.json')};
const freePort=()=>new Promise((resolve,reject)=>{
 const s=createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
});
const graph=[],endpoints=new Map();
async function launch([id,caps]){
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const entry=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
 const proc=spawn(process.execPath,[entry],{stdio:'ignore',env:{
  ...process.env,...state,ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,APP_PORT:String(port)}});
 running.push(proc);let ready=false;
 for(let i=0;i<80;i++){
  await new Promise(done=>setTimeout(done,35));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
 }
 assert(ready,id+' did not start');
 assert.equal((await fetch(base+'/graph')).status,401);
 const manifest=JSON.parse(await readFile(new URL('../apps/'+id+'/manifest.json',import.meta.url)));
 const g=await (await fetch(base+'/graph',{headers:{'x-internal-key':secret}})).json();
 assert(validateGraph(g,manifest),id+' invalid MAS graph');
 for(const node of g.nodes){
  graph.push(node);
  if(node.type==='action')endpoints.set(node.id,base);
 }
}
const find=(domain,action)=>{
 const skill=graph.find(n=>n.type==='resource'&&
  n.skill?.schema==='mikoshi.skill.v1'&&n.skill.domain===domain);
 assert(skill,domain+' provider missing');
 const id=skill.skill.actions[action];
 assert(endpoints.has(id),'action not advertised '+domain+'.'+action);
 return id;
};
const call=async(action,params={},authorized=true)=>{
 const base=endpoints.get(action);assert(base,'missing action '+action);
 const res=await fetch(base+'/invoke',{method:'POST',
  headers:{'content-type':'application/json',
   ...(authorized?{'x-internal-key':secret}:{})},
  body:JSON.stringify({action,params})});
 const body=await res.json();
 return {status:res.status,result:body.result,error:body.error};
};
try{
 for(const spec of repo)await launch(spec);
 const analyze=find('auditory-events','analyze'),
  recognize=find('auditory-memory','recognize'),
  remember=find('auditory-memory','remember'),
  teach=find('auditory-sequence','teach');
 const a=synth({f1:810,f2:1290}),i=synth({f1:300,f2:2450});
 const stream=[...Array(2400).fill(0),...a,...Array(1200).fill(0),
  ...i,...Array(2400).fill(0)];
 assert.equal((await call(analyze,{samples:stream,sampleRate:12000},false)).status,401);
 const detected=await call(analyze,{samples:stream,sampleRate:12000});
 assert.equal(detected.status,200);
 assert.equal(detected.result.detected,2);
 await assert.rejects(access(state.MIKOSHI_MOTIFS_STATE));
 const ids=[];
 for(const event of detected.result.events){
  const query={samples:event.samples,sampleRate:12000};
  assert.equal((await call(recognize,query)).result.matched,false);
  assert.equal((await call(remember,query)).status,400,'learning requires approval');
  const training=await call(remember,{...query,sourceApproved:true});
  assert.equal(training.status,200);
  ids.push({id:training.result.id,gapMs:ids.length?event.gapMs:0});
 }
 assert.notEqual(ids[0].id,ids[1].id);
 const learned=await call(teach,{events:ids,sourceApproved:true});
 assert.equal(learned.status,200);
 const saved=JSON.parse(await readFile(state.MIKOSHI_SEQUENCE_STATE,'utf8'));
 assert.equal(saved.episodes,1);
 assert(!JSON.stringify(saved).includes('samples'));
 for(const event of detected.result.events)
  assert((await call(recognize,{samples:event.samples,sampleRate:12000})).result.matched);
 console.log('MIKOSHI_STREAM_LIVE_OK real segmentation -> motif memory -> temporal learning');
}finally{
 for(const proc of running)proc.kill();
 await rm(dir,{force:true,recursive:true});
}
