import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../core/contract.mjs';
const specs=[['mikoshi_vision','vision.inspect'],
 ['mikoshi_phonetics','phonetics.inspect,phonetics.render'],
 ['mikoshi_motifs','motifs.inspect,motifs.learn'],
 ['mikoshi_grounding','grounding.inspect,grounding.learn']];
const key=randomBytes(32).toString('hex'),children=[],actions=new Map();
const dir=await mkdtemp(join(tmpdir(),'mikoshi-av-live-'));
const states={MIKOSHI_MOTIFS_STATE:join(dir,'motifs.json'),
 MIKOSHI_GROUNDING_STATE:join(dir,'grounding.json')};
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});
async function launch([id,caps]){
 const p=await port(),base='http://127.0.0.1:'+p;
 const file=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
 const child=spawn(process.execPath,[file],{stdio:'ignore',env:{
  ...process.env,...states,ADA_INTERNAL_KEY:key,ADA_CAPS:caps,APP_PORT:String(p)}});
 children.push(child);let ready=false;
 for(let t=0;t<90;t++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
 }
 assert(ready,id+' must start independently');
 assert.equal((await fetch(base+'/graph')).status,401);
 const manifest=JSON.parse(await readFile(new URL(
  '../apps/'+id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest));
 for(const n of graph.nodes)if(n.type==='action')actions.set(n.id,base);
 return {child,graph};
}
async function call(action,params={},auth=true){
 const base=actions.get(action);assert(base,'missing action '+action);
 const res=await fetch(base+'/invoke',{method:'POST',headers:{
  'content-type':'application/json',...(auth?{'x-internal-key':key}:{})},
  body:JSON.stringify({action,params})});
 const doc=await res.json();return {status:res.status,...doc};
}
const blank=Array(192).fill(0),square=c=>{
 const p=[...blank];
 for(let y=2;y<5;y++)for(let x=2;x<5;x++)p[(y*8+x)*3+c]=1;
 return p;
};
const frames=[{timeMs:0,pixels:blank},{timeMs:200,pixels:square(0)},
 {timeMs:400,pixels:blank},{timeMs:600,pixels:square(2)}];
try{
 for(const spec of specs)await launch(spec);
 const scene=await call('mikoshi_vision.analyze',{frames});
 assert.equal(scene.status,200);
 const visual=scene.result.events.filter(e=>e.kind==='appear');
 assert.equal(visual.length,2);
 const sounds=[];
 for(const motor of [{f1:810,f2:1290},{f1:300,f2:2450}]){
  const voice=await call('mikoshi_phonetics.preview',{motor});
  assert.equal(voice.status,200);
  sounds.push(voice.result.samples);
 }
 const learned=[];
 for(let lesson=0;lesson<2;lesson++){
  for(let i=0;i<2;i++){
   const visualEvent=visual[i];
   const m=await call('mikoshi_motifs.remember',{
    samples:sounds[i],sampleRate:12000,sourceApproved:true});
   assert.equal(m.status,200);
   if(lesson===0)learned[i]=m.result.id;
   assert.equal(m.result.id,learned[i]);
   const params={visualVector:visualEvent.vector,
    visualAtMs:visualEvent.timeMs,soundAtMs:visualEvent.timeMs+15,
    soundId:m.result.id,sourceApproved:true};
   if(lesson===0&&i===0){
    assert.equal((await call('mikoshi_grounding.teach',params,false)).status,401);
    assert.equal((await call('mikoshi_grounding.teach',{
     ...params,sourceApproved:false})).status,400);
   }
   const pair=await call('mikoshi_grounding.teach',params);
   assert.equal(pair.status,200);
   const recognized=await call('mikoshi_grounding.associate',
    {visualVector:visualEvent.vector});
   assert.equal(recognized.result.ready,lesson===1);
   assert.equal(recognized.result.candidates[0].soundId,m.result.id);
  }
 }
 assert.notEqual(learned[0],learned[1]);
 for(let i=0;i<2;i++){
  const recalled=await call('mikoshi_grounding.recall',{soundId:learned[i]});
  assert(recalled.result.ready);
  const assoc=await call('mikoshi_grounding.associate',
   {visualVector:visual[i].vector});
  assert.equal(assoc.result.candidates[0].soundId,learned[i]);
 }
 const bad=await call('mikoshi_grounding.teach',{visualVector:visual[0].vector,
  visualAtMs:200,soundAtMs:900,soundId:learned[0],sourceApproved:true});
 assert.equal(bad.status,400);
 const stored=JSON.parse(await readFile(states.MIKOSHI_GROUNDING_STATE,'utf8'));
 assert.equal(stored.visuals.length,2);assert.equal(stored.paired,4);
 assert(!JSON.stringify(stored).includes('samples'));
 assert(!JSON.stringify(stored).includes('pixels'));
 console.log('MIKOSHI_AV_LIVE_OK four MAS services, repeated pairs and abstention');
}finally{for(const c of children)c.kill();
 await rm(dir,{recursive:true,force:true});}
