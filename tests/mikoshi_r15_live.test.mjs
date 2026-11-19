import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateGraph} from '../core/contract.mjs';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
const names=[['mikoshi_vision','vision.inspect'],
 ['mikoshi_tracking','tracking.inspect'],
 ['mikoshi_segments','segments.observe'],['mikoshi_clockcal','clock.inspect'],
 ['mikoshi_avsync','avsync.inspect'],
 ['mikoshi_sourcepolicy','source.inspect,source.authorize'],
 ['mikoshi_motifs','motifs.inspect,motifs.learn'],
 ['mikoshi_grounding','grounding.inspect,grounding.learn']];
const key=randomBytes(32).toString('hex'),children=[],actions=new Map();
const dir=await mkdtemp(join(tmpdir(),'mikoshi-r15-'));
const env={MIKOSHI_MOTIFS_STATE:join(dir,'motifs.json'),
 MIKOSHI_GROUNDING_STATE:join(dir,'grounding.json'),
 MIKOSHI_SOURCE_SIGNING_KEY:randomBytes(40).toString('hex')};
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});
});
async function launch([id,caps]){
 const p=await port(),base='http://127.0.0.1:'+p;
 const entry=fileURLToPath(new URL('../apps/'+id+'/service.mjs',import.meta.url));
 const child=spawn(process.execPath,[entry],{stdio:'ignore',env:{
  ...process.env,...env,ADA_INTERNAL_KEY:key,ADA_CAPS:caps,APP_PORT:String(p)}});
 children.push(child);let ok=false;
 for(let t=0;t<90;t++){
  await new Promise(resolve=>setTimeout(resolve,35));
  try{if((await fetch(base+'/health')).ok){ok=true;break;}}catch{}
 }
 assert(ok,id+' did not start');assert.equal((await fetch(base+'/graph')).status,401);
 const manifest=JSON.parse(await readFile(new URL('../apps/'+id+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest),id+' graph invalid');
 for(const n of graph.nodes)if(n.type==='action')actions.set(n.id,base);
}
async function call(action,params={},authorized=true){
 const base=actions.get(action);assert(base,action+' absent');
 const res=await fetch(base+'/invoke',{method:'POST',headers:{
  'content-type':'application/json',...(authorized?{'x-internal-key':key}:{})},
  body:JSON.stringify({action,params})});
 const body=await res.json();return {status:res.status,...body};
}
const blank=Array(192).fill(0),square=(x,y,c)=>{
 const p=[...blank];for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)
  p[((y+dy)*8+x+dx)*3+c]=1;return p;
};
try{
 for(const s of names)await launch(s);
 const frames=[{timeMs:0,pixels:blank},
  {timeMs:200,pixels:square(1,2,0)},
  {timeMs:400,pixels:square(2,2,0)},
  {timeMs:600,pixels:blank},
  {timeMs:800,pixels:square(5,5,2)},
  {timeMs:1000,pixels:square(4,5,2)}];
 const a=synth({f1:810,f2:1290}),b=synth({f1:300,f2:2450});
 const input=[...Array(2400).fill(0),...a,...Array(4800).fill(0),
  ...b,...Array(2400).fill(0)];
 const v=(await call('mikoshi_vision.analyze',{frames})).result;
 const t=(await call('mikoshi_tracking.track',{frames})).result;
 const s=(await call('mikoshi_segments.analyze',
  {samples:input,sampleRate:12000})).result;
 assert.equal(t.tracks.length,2);
 assert(t.tracks.every(track=>track.observations===2));
 assert.equal(s.detected,2);
 const cues=[100,500,900].map(n=>({
  visualAtMs:n,audioAtMs:n,knownCommonStimulus:true}));
 const cal=(await call('mikoshi_clockcal.estimate',
  {cues,referenceUncertaintyMs:30})).result;
 assert(cal.usable);assert.equal(cal.hardwareCalibrated,false);
 const shifted=(await call('mikoshi_clockcal.shift',{
  audioEvents:s.events.map(e=>({timeMs:e.timeMs})),calibration:cal})).result;
 const aligned=(await call('mikoshi_avsync.align',{
  visualEvents:v.events.map(e=>({timeMs:e.timeMs,kind:e.kind})),
  audioEvents:shifted.audioEvents,uncertaintyMs:shifted.uncertaintyMs})).result;
 assert.equal(aligned.matches.length,2);
 const pairs=aligned.matches.map(p=>({
  visual:v.events[p.visualIndex],audio:s.events[p.audioIndex],p}));
 const digest=createHash('sha256').update(JSON.stringify(pairs)).digest('hex');
 const claim={sourceKind:'user-live-av',captureMethod:'explicit-gesture',
  purpose:'audiovisual-association-training',captureConsent:true,
  subjectsConsentConfirmed:true,noThirdPartyMedia:true,rawRetention:false,
  sessionDurationMs:1600,pairs:2,digest};
 assert.equal((await call('mikoshi_sourcepolicy.authorize',
  {claim},false)).status,401);
 const signed=(await call('mikoshi_sourcepolicy.authorize',{claim})).result;
 assert(signed?.token);
 assert.equal((await call('mikoshi_sourcepolicy.verify',{token:signed.token,
  digest:'b'.repeat(64),purpose:claim.purpose})).status,400);
 for(let round=0;round<2;round++)for(const {visual,audio,p} of pairs){
  const verified=(await call('mikoshi_sourcepolicy.verify',{token:signed.token,
   digest,purpose:claim.purpose})).result;
  assert(verified.allowed&&!verified.verifiedConsent);
  const motif=(await call('mikoshi_motifs.remember',{
   samples:audio.samples,sampleRate:12000,sourceApproved:true})).result;
  const linked=(await call('mikoshi_grounding.teach',{
   visualVector:visual.vector,soundId:motif.id,
   visualAtMs:p.visualAtMs,soundAtMs:p.soundAtMs,
   sourceApproved:true})).result;
  assert.equal(linked.support,round+1);
 }
 const storage=JSON.parse(await readFile(env.MIKOSHI_GROUNDING_STATE,'utf8'));
 assert.equal(storage.paired,4);
 assert(!JSON.stringify(storage).includes('samples'));
 assert(!JSON.stringify(storage).includes('pixels'));
 console.log('MIKOSHI_R15_LIVE_OK eight MAS services, tracks, clock estimate, permit, learning');
}finally{for(const p of children)p.kill();await rm(dir,{force:true,recursive:true});}
