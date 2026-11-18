import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {free,stop} from './http-fixture.mjs';
import {fixture} from './fixture.mjs';
import {ORIGIN} from '../lib/contract.mjs';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const source=join(repo,'packages','network_witness');
const pause=t=>new Promise(ok=>setTimeout(ok,t));
const token='witness-core-operator-token-long',key='witness-core-internal-secret-long';
test('real Core + network_witness alone, auth, signed anchor and hot revocation',{timeout:35000},async()=>{
 const f=await fixture(),temp=await mkdtemp(join(tmpdir(),'witness-core-')),
  runtime=join(temp,'runtime'),home=join(temp,'home'),corePort=await free(),appPort=await free();
 let core,app;const base='http://127.0.0.1:'+corePort;
 const bearer={Authorization:'Bearer '+token};
 async function graph(){const r=await fetch(base+'/api/graph',{headers:bearer,signal:AbortSignal.timeout(900)});return r.json();}
 async function invoke(action,params={}){const r=await fetch(base+'/api/invoke',{method:'POST',
  headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify({action,params}),
  signal:AbortSignal.timeout(2500)});return {status:r.status,body:await r.json()};}
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});await mkdir(join(runtime,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});
  await cp(source,join(runtime,'apps','network_witness'),{recursive:true});
  const mp=join(runtime,'apps','network_witness','manifest.json');const m=JSON.parse(await readFile(mp,'utf8'));
  m.service.port=appPort;await writeFile(mp,JSON.stringify(m));
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,ADA_INTERNAL_KEY:key,
   ADA_CAPS:'network_witness.read,network_witness.write',ADA_PORT:String(corePort),APP_PORT:String(appPort),
   NETWORK_WITNESS_LOG:f.logPath,NETWORK_WITNESS_KEY:f.keyPath,NETWORK_WITNESS_TRUST:f.trustPath};
  app=spawn(process.execPath,[join(runtime,'apps','network_witness','service.mjs')],{env,stdio:'ignore'});
  core=spawn(process.execPath,[join(runtime,'core','kernel.mjs')],{env,stdio:'ignore'});
  let seen=null;
  for(let i=0;i<120;i++){
   if(app.exitCode!==null||core.exitCode!==null)throw Error('unexpected_exit');
   try{const g=await graph();if(g.nodes?.some(n=>n.id==='network_witness.anchor')){seen=g;break;}}
   catch{}await pause(100);
  }
  assert(seen,'Core did not discover Witness');
  assert(seen.nodes.every(n=>n.id.startsWith('network_witness.')),'Optional app was required');
  assert.equal((await fetch(base+'/api/graph')).status,401);
  assert.equal((await invoke('network_witness.apply')).status,403);
  const a=f.segment();const proof=await invoke('network_witness.anchor',{...a,expectedRevision:ORIGIN});
  assert.equal(proof.status,200,JSON.stringify(proof.body));
  assert.equal((await invoke('network_witness.inspect',a)).body.result.state,'matches_witness');
  await stop(app);app=null;
  const after=await graph();assert(after.nodes.every(n=>!n.id.startsWith('network_witness.')));
 }finally{await Promise.all([stop(core),stop(app)]);await rm(temp,{recursive:true,force:true,maxRetries:4,retryDelay:100});await f.remove();}
});
