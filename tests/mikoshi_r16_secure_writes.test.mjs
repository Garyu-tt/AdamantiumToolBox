import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {audioHash,visualHash,digest} from '../contracts/mikoshi-av-permit.mjs';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {validateGraph} from '../core/contract.mjs';
const key=randomBytes(32).toString('hex');
const secret=randomBytes(40).toString('hex');
const dir=await mkdtemp(join(tmpdir(),'mikoshi-secure-'));
const env={ADA_INTERNAL_KEY:key,MIKOSHI_SOURCE_SIGNING_KEY:secret,
 MIKOSHI_REQUIRE_SOURCE_PERMIT:'1',MIKOSHI_MOTIFS_STATE:join(dir,'motifs.json'),
 MIKOSHI_GROUNDING_STATE:join(dir,'grounding.json')};
const children=[],actions=new Map();
const port=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>ok(n));});
});
async function start(name,caps){
 const n=await port(),base='http://127.0.0.1:'+n;
 const exe=fileURLToPath(new URL('../apps/'+name+'/service.mjs',import.meta.url));
 const child=spawn(process.execPath,[exe],{stdio:'ignore',env:{
  ...process.env,...env,ADA_CAPS:caps,APP_PORT:String(n)}});
 children.push(child);let up=false;
 for(let i=0;i<90;i++){
  await new Promise(ok=>setTimeout(ok,35));
  try{if((await fetch(base+'/health')).ok){up=true;break;}}catch{}
 }
 assert(up,name+' failed to start');
 const manifest=JSON.parse(await readFile(new URL(
  '../apps/'+name+'/manifest.json',import.meta.url)));
 const graph=await (await fetch(base+'/graph',{
  headers:{'x-internal-key':key}})).json();
 assert(validateGraph(graph,manifest));
 for(const n of graph.nodes)if(n.type==='action')actions.set(n.id,base);
 return child;
}
async function call(action,params={},auth=true){
 const base=actions.get(action);assert(base,'missing action '+action);
 const res=await fetch(base+'/invoke',{method:'POST',headers:{
  'content-type':'application/json',...(auth?{'x-internal-key':key}:{})},
  body:JSON.stringify({action,params})});
 return {status:res.status,...await res.json()};
}
try{
 await start('mikoshi_sourcepolicy','source.inspect,source.authorize');
 let motif=await start('mikoshi_motifs','motifs.inspect,motifs.learn');
 let ground=await start('mikoshi_grounding','grounding.inspect,grounding.learn');
 const samples=synth({f1:810,f2:1290}),sampleRate=12000;
 const visualVector=Array(10).fill(.2),visualAtMs=200,soundAtMs=215;
 const pair={audioHash:audioHash(samples,sampleRate),
  visualHash:visualHash(visualVector,visualAtMs,soundAtMs)};
 const lessonDigest=digest({pair,lesson:'R16'});
 const claim={sourceKind:'user-live-av',captureMethod:'explicit-gesture',
  purpose:'audiovisual-association-training',captureConsent:true,
  subjectsConsentConfirmed:true,noThirdPartyMedia:true,rawRetention:false,
  sessionDurationMs:1600,pairs:1,digest:lessonDigest,pairBindings:[pair]};
 const signed=(await call('mikoshi_sourcepolicy.authorize',{claim})).result;
 assert(signed.token);
 const shared={sourcePermit:signed.token,lessonDigest,pairIndex:0,
  sourceApproved:true};
 const sound={samples,sampleRate,...shared};
 assert.equal((await call('mikoshi_motifs.remember',sound,false)).status,401);
 assert.equal((await call('mikoshi_motifs.remember',{
  samples,sampleRate,sourceApproved:true})).status,400,
  'legacy flag cannot bypass protected memory');
 assert.equal((await call('mikoshi_motifs.remember',{
  ...sound,samples:[...samples].fill(0)})).status,400,
  'signed pair must match actual submitted audio');
 const remembered=(await call('mikoshi_motifs.remember',sound)).result;
 assert(remembered?.sourceReceipt&&/^m[0-9]+$/.test(remembered.id));
 const ticket={sourcePermit:signed.token,lessonDigest,pairIndex:0};
 assert.equal((await call('mikoshi_motifs.receipt',ticket)).result.applied,true);
 assert.equal((await call('mikoshi_grounding.receipt',ticket)).result.applied,false,
  'interrupted transaction is observable before association write');
 const teach={visualVector,visualAtMs,soundAtMs,soundId:remembered.id,
  ...shared,motifReceipt:remembered.sourceReceipt};
 assert.equal((await call('mikoshi_grounding.teach',{
  ...teach,motifReceipt:undefined})).status,400);
 assert.equal((await call('mikoshi_grounding.teach',{
  ...teach,soundId:'m99999'})).status,400);
 assert.equal((await call('mikoshi_grounding.teach',{
  ...teach,visualVector:[...visualVector].fill(.8)})).status,400);
 const linked=(await call('mikoshi_grounding.teach',teach)).result;
 assert.equal(linked.support,1);
 assert.equal((await call('mikoshi_grounding.receipt',ticket)).result.applied,true);
 assert.deepEqual((await call('mikoshi_motifs.remember',sound)).result,remembered);
 assert.deepEqual((await call('mikoshi_grounding.teach',teach)).result,linked);
 assert.equal((await call('mikoshi_motifs.status')).result.heard,1);
 assert.equal((await call('mikoshi_grounding.status')).result.paired,1);
 motif.kill();ground.kill();
 motif=await start('mikoshi_motifs','motifs.inspect,motifs.learn');
 ground=await start('mikoshi_grounding','grounding.inspect,grounding.learn');
 assert.deepEqual((await call('mikoshi_motifs.remember',sound)).result,remembered);
 assert.deepEqual((await call('mikoshi_grounding.teach',teach)).result,linked);
 assert.equal((await call('mikoshi_grounding.status')).result.paired,1);
 const provenance=JSON.parse(await readFile(env.MIKOSHI_GROUNDING_STATE,'utf8'));
 assert.equal(provenance.sourceWrites.length,1);
 assert.equal(provenance.sourceWrites[0].lessonDigest,lessonDigest);
 assert(!JSON.stringify(provenance).includes('samples'));
 console.log('MIKOSHI_R16_SECURE_OK three MAS services, tamper rejection, readback, idempotent restart');
}finally{for(const p of children)p.kill();await rm(dir,{recursive:true,force:true});}
