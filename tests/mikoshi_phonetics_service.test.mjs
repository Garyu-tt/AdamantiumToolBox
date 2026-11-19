import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateGraph} from '../core/contract.mjs';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {readFile as file} from 'node:fs/promises';
const manifest=JSON.parse(await file(new URL('../apps/mikoshi_phonetics/manifest.json',import.meta.url)));
const choose=()=>new Promise((ok,bad)=>{
 const s=createServer().once('error',bad);
 s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});
});
const port=await choose(),key=randomBytes(32).toString('hex');
const dir=await mkdtemp(join(tmpdir(),'mikoshi-phonetics-test-'));
const path=join(dir,'state.json'),base='http://127.0.0.1:'+port;
const worker=spawn(process.execPath,[fileURLToPath(new URL('../apps/mikoshi_phonetics/service.mjs',import.meta.url))],{
 env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:key,
  ADA_CAPS:'phonetics.inspect,phonetics.render,phonetics.learn',
  MIKOSHI_PHONETICS_STATE:path},stdio:'ignore'});
const call=(action,params={},authenticated=true)=>fetch(base+'/invoke',{
 method:'POST',headers:{'content-type':'application/json',
  ...(authenticated?{'x-internal-key':key}:{})},
 body:JSON.stringify({action,params})});
try{
 let alive=false;
 for(let i=0;i<60;i++){
  await new Promise(ok=>setTimeout(ok,40));
  try{if((await fetch(base+'/health')).ok){alive=true;break;}}catch{}
 }
 assert(alive,'service must boot in isolation');
 assert.equal((await fetch(base+'/graph')).status,401);
 const g=await (await fetch(base+'/graph',{headers:{'x-internal-key':key}})).json();
 assert(validateGraph(g,manifest));
 const ids=g.nodes.map(x=>x.id);
 assert(ids.includes('mikoshi_phonetics.imitate'));
 const reference=synth({f1:810,f2:1290});
 const denied=await call('mikoshi_phonetics.imitate',{samples:reference});
 assert.equal(denied.status,400,'unapproved samples must not train');
 const req=await call('mikoshi_phonetics.imitate',{
  samples:reference,sampleRate:12000,sourceApproved:true});
 assert.equal(req.status,200);
 const trained=(await req.json()).result;
 assert.equal(trained.lessons,1);
 assert(trained.after<trained.before);
 const doc=JSON.parse(await readFile(path,'utf8'));
 assert.equal(doc.lessons,1);assert(!('samples' in doc),'raw teaching audio is not retained');
 assert.equal((await call('mikoshi_phonetics.status',{},false)).status,401);
 console.log('MIKOSHI_PHONETICS_SERVICE_OK graph, permissions, training, no raw retention');
}finally{worker.kill();await rm(dir,{recursive:true,force:true});}
