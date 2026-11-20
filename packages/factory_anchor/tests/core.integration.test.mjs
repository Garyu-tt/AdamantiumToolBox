// SPDX-License-Identifier: Apache-2.0
// True Core + factory_anchor only; no JediControl or optional MAS service.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fixture} from './fixture.mjs';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const packageRoot=join(repo,'packages/factory_anchor');
const free=()=>new Promise(resolve=>{
 const s=createServer();s.listen(0,'127.0.0.1',()=>{
  const p=s.address().port;s.close(()=>resolve(p));
 });
});
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function stop(proc){
 if(!proc||proc.exitCode!==null)return;
 proc.kill('SIGTERM');
 for(let i=0;i<100&&proc.exitCode===null;i++)await pause(35);
 if(proc.exitCode===null)proc.kill('SIGKILL');
}
test('Core + factory_anchor alone: signed public verification, scope and dynamic withdrawal',
 {timeout:40000},async()=>{
 const f=await fixture(),tmp=await mkdtemp(join(tmpdir(),'factory-anchor-core-r09-'));
 const corePort=await free(),appPort=await free();
 const runtime=join(tmp,'runtime'),home=join(tmp,'home');
 const base='http://127.0.0.1:'+corePort;
 const token='factory-anchor-core-test-token-very-long';
 const header={Authorization:'Bearer '+token};
 const graph=async()=>{
  const r=await fetch(base+'/api/graph',{headers:header,
   signal:AbortSignal.timeout(950)});
  return r.json();
 };
 let core=null,app=null;const stderr={core:'',app:''};
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});
  await mkdir(join(runtime,'interface'),{recursive:true});
  await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});
  await cp(packageRoot,join(runtime,'apps/factory_anchor'),{recursive:true});
  const manifest=join(runtime,'apps/factory_anchor/manifest.json');
  const props=JSON.parse(await readFile(manifest,'utf8'));
  props.service.port=appPort;await writeFile(manifest,JSON.stringify(props));
  const env={
   ...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,
   ADA_INTERNAL_KEY:'factory-anchor-core-test-internal-key-long',
   ADA_CAPS:'factory_anchor.read',
   ADA_PORT:String(corePort),APP_PORT:String(appPort),
   FACTORY_ANCHOR_ROOT:f.root,
   FACTORY_ANCHOR_PUBLIC_PIN:f.anchorPin,
   FACTORY_ANCHOR_SOURCE_PIN:f.sourcePin,
   FACTORY_ANCHOR_LEDGER_ID:f.ledgerId,
   FACTORY_ANCHOR_ALLOW_SIGNING:'no'
  };
  app=spawn(process.execPath,[join(runtime,'apps/factory_anchor/service.mjs')],
   {env,stdio:['ignore','ignore','pipe']});
  core=spawn(process.execPath,[join(runtime,'core/kernel.mjs')],
   {env,stdio:['ignore','ignore','pipe']});
  for(const [name,p] of [['core',core],['app',app]])
   p.stderr.on('data',buffer=>stderr[name]=(stderr[name]+buffer).slice(-1900));
  let discovered=false;
  for(let i=0;i<140;i++){
   if(app.exitCode!==null||core.exitCode!==null)
    throw Error('child_early_exit:'+JSON.stringify(stderr));
   try{
    const g=await graph();
    if(g.nodes?.some(n=>n.id==='factory_anchor.inspect')){
     assert.ok(g.nodes.every(n=>n.id.startsWith('factory_anchor.')));
     assert.ok(!g.nodes.some(n=>n.id==='factory_anchor.attest'));
     discovered=true;break;
    }
   }catch{}
   await pause(55);
  }
  assert.equal(discovered,true,'Core did not discover standalone factory_anchor '+JSON.stringify(stderr));
  assert.equal((await fetch(base+'/api/graph')).status,401);
  const unknown=await fetch(base+'/api/invoke',{method:'POST',
   headers:{...header,'Content-Type':'application/json'},
   body:JSON.stringify({action:'factory_anchor.install'})});
  assert.equal(unknown.status,403);
  const status=await fetch(base+'/api/invoke',{method:'POST',
   headers:{...header,'Content-Type':'application/json'},
   body:JSON.stringify({action:'factory_anchor.status'})});
  assert.equal(status.status,200);
  assert.equal((await status.json()).result.configured,true);
  await stop(app);app=null;
  const after=await graph();
  assert.equal(after.nodes.some(n=>n.id.startsWith('factory_anchor.')),false,
   'failed to withdraw capabilities after app shutdown');
 }finally{
  await Promise.all([stop(app),stop(core)]);
  await f.remove();
  await rm(tmp,{recursive:true,force:true,maxRetries:4,retryDelay:100});
 }
});
