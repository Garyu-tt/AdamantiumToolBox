import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixture} from './fixture.mjs';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const source=join(repo,'packages/network_anchor');
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stop(p){if(!p||p.exitCode!==null)return;p.kill('SIGTERM');for(let i=0;i<60&&p.exitCode===null;i++)await pause(40);if(p.exitCode===null)p.kill('SIGKILL');}
test('real Core + network_anchor only; auth, write block and hot capability revocation',{timeout:35000},async()=>{
 const f=await fixture(),tmp=await mkdtemp(join(tmpdir(),'anchor-core-'));
 const runtime=join(tmp,'runtime'),home=join(tmp,'home'),corePort=await free(),appPort=await free();
 const host='http://127.0.0.1:'+corePort,auth='anchor-test-core-bearer-token-long';
 let app,core;const logs={app:'',core:''};
 const bearer={Authorization:'Bearer '+auth};
 const graph=async()=>{const r=await fetch(host+'/api/graph',{headers:bearer,signal:AbortSignal.timeout(900)});return r.json();};
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});await mkdir(join(runtime,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});
  await cp(source,join(runtime,'apps/network_anchor'),{recursive:true});
  const mp=join(runtime,'apps/network_anchor/manifest.json');const m=JSON.parse(await readFile(mp,'utf8'));
  m.service.port=appPort;await writeFile(mp,JSON.stringify(m));
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:auth,
   ADA_INTERNAL_KEY:'anchor-test-core-internal-key-long',ADA_CAPS:'network_anchor.read,network_anchor.write',
   ADA_PORT:String(corePort),APP_PORT:String(appPort),NETWORK_ANCHOR_LOG:f.logPath,
   NETWORK_ANCHOR_TRUST:f.trustPath,NETWORK_ANCHOR_KEY:f.keyPath};
  app=spawn(process.execPath,[join(runtime,'apps/network_anchor/service.mjs')],{env,stdio:['ignore','ignore','pipe']});
  core=spawn(process.execPath,[join(runtime,'core/kernel.mjs')],{env,stdio:['ignore','ignore','pipe']});
  for(const [name,p] of [['app',app],['core',core]])p.stderr.on('data',s=>logs[name]=(logs[name]+s).slice(-1300));
  let discovered=null;for(let i=0;i<125;i++){
   if(app.exitCode!==null||core.exitCode!==null)throw Error('early_exit '+JSON.stringify(logs));
   try{const g=await graph();if(g.nodes?.some(x=>x.id==='network_anchor.commit')){discovered=g;break;}}catch{}await pause(80);
  }
  assert(discovered,'Core did not discover Anchor '+JSON.stringify(logs));
  assert(discovered.nodes.every(n=>n.id.startsWith('network_anchor.')),'optional app required');
  assert.equal((await fetch(host+'/api/graph')).status,401);
  const unknown=await fetch(host+'/api/invoke',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},
   body:JSON.stringify({action:'network_anchor.apply'})});assert.equal(unknown.status,403);
  await stop(app);app=null;const after=await graph();
  assert(after.nodes.every(n=>!n.id.startsWith('network_anchor.')),'capability not withdrawn');
 }finally{await Promise.all([stop(app),stop(core)]);await f.remove();await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
