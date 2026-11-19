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
const specs=[['mikoshi_vision','vision.inspect'],
 ['mikoshi_segments','segments.observe'],['mikoshi_avsync','avsync.inspect'],
 ['mikoshi_motifs','motifs.inspect,motifs.learn'],
 ['mikoshi_grounding','grounding.inspect,grounding.learn']];
const key=randomBytes(32).toString('hex'),children=[],actions=new Map();
const dir=await mkdtemp(join(tmpdir(),'mikoshi-avsync-'));
const states={MIKOSHI_MOTIFS_STATE:join(dir,'motifs.json'),
 MIKOSHI_GROUNDING_STATE:join(dir,'grounding.json')};
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>ok(n));});
});
async function start([id,caps]){
 const n=await port(),base='http://127.0.0.1:'+n;
 const exe=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
 const child=spawn(process.execPath,[exe],{stdio:'ignore',env:{
  ...process.env,...states,ADA_INTERNAL_KEY:key,ADA_CAPS:caps,APP_PORT:String(n)}});
 children.push(child);let up=false;
 for(let i=0;i<90;i++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){up=true;break;}}catch{}
 }
 assert(up,id+' failed to start');
 assert.equal((await fetch(base+'/graph')).status,401);
 const m=JSON.parse(await readFile(new URL('../apps/'+id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,m),id+' invalid MAS graph');
 for(const node of graph.nodes)if(node.type==='action')actions.set(node.id,base);
}
async function call(action,params={},auth=true){
 const base=actions.get(action);assert(base,'missing '+action);
 const res=await fetch(base+'/invoke',{method:'POST',headers:{
  'content-type':'application/json',...(auth?{'x-internal-key':key}:{})},
  body:JSON.stringify({action,params})});
 const data=await res.json();return {status:res.status,...data};
}
const empty=Array(192).fill(0);
const square=c=>{
 const p=[...empty];for(let y=2;y<5;y++)for(let x=2;x<5;x++)
  p[(y*8+x)*3+c]=1;
 return p;
};
try{
 for(const x of specs)await start(x);
 const frames=[{timeMs:0,pixels:empty},{timeMs:200,pixels:square(0)},
  {timeMs:400,pixels:empty},{timeMs:600,pixels:square(2)}];
 const sound=[...Array(2400).fill(0),...synth({f1:810,f2:1290}),
  ...Array(2400).fill(0),...synth({f1:300,f2:2450}),
  ...Array(2400).fill(0)];
 const visual=(await call('mikoshi_vision.analyze',{frames})).result;
 const audio=(await call('mikoshi_segments.analyze',{
  samples:sound,sampleRate:12000})).result;
 assert.equal(visual.events.filter(x=>x.kind==='appear').length,2);
 assert.equal(audio.detected,2);
 const request={visualEvents:visual.events.map(x=>({timeMs:x.timeMs,kind:x.kind})),
  audioEvents:audio.events.map(x=>({timeMs:x.timeMs})),uncertaintyMs:160};
 assert.equal((await call('mikoshi_avsync.align',request,false)).status,401);
 const aligned=await call('mikoshi_avsync.align',request);
 assert.equal(aligned.status,200);
 assert.equal(aligned.result.matches.length,2);
 const alignedEvents=aligned.result.matches.map(p=>({
  visual:visual.events[p.visualIndex],audio:audio.events[p.audioIndex],p}));
 const ids=[];
 for(let pass=0;pass<2;pass++)for(let i=0;i<alignedEvents.length;i++){
  const {visual:v,audio:a,p}=alignedEvents[i];
  const m=await call('mikoshi_motifs.remember',{
   samples:a.samples,sampleRate:12000,sourceApproved:true});
  assert.equal(m.status,200);
  if(pass===0)ids[i]=m.result.id;
  assert.equal(m.result.id,ids[i]);
  const pair={visualVector:v.vector,soundId:m.result.id,
   visualAtMs:p.visualAtMs,soundAtMs:p.soundAtMs,sourceApproved:true};
  if(pass===0&&i===0){
   assert.equal((await call('mikoshi_grounding.teach',
    {...pair,sourceApproved:false})).status,400);
  }
  assert.equal((await call('mikoshi_grounding.teach',pair)).status,200);
  const result=await call('mikoshi_grounding.associate',{visualVector:v.vector});
  assert.equal(result.result.ready,pass===1);
 }
 assert.notEqual(ids[0],ids[1]);
 const state=JSON.parse(await readFile(states.MIKOSHI_GROUNDING_STATE,'utf8'));
 assert.equal(state.paired,4);assert.equal(state.visuals.length,2);
 assert(!JSON.stringify(state).includes('pixels'));
 assert(!JSON.stringify(state).includes('samples'));
 console.log('MIKOSHI_AVSYNC_LIVE_OK five real MAS services, acoustic/visual clock join');
}finally{for(const c of children)c.kill();await rm(dir,{force:true,recursive:true});}
