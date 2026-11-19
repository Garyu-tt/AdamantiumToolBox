import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {free,stop} from './fixture.mjs';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const bearer='audit-anchor-transport-core-long-token';
const internal='audit-anchor-transport-core-key-long';
test('Core + network_anchor_transport only, status-only when remote absent, unauthorized and hot revoke',{timeout:35000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'anchor-transport-core-')),runtime=join(tmp,'runtime'),home=join(tmp,'home');
 const corePort=await free(),appPort=await free(),base='http://127.0.0.1:'+corePort;
 let core,app;let coreError='',appError='';
 const auth={Authorization:'Bearer '+bearer};
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});await mkdir(join(runtime,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(root,'core'),join(runtime,'core'),{recursive:true});
  await cp(join(root,'packages/network_anchor_transport'),join(runtime,'apps/network_anchor_transport'),{recursive:true});
  const path=join(runtime,'apps/network_anchor_transport/manifest.json');const m=JSON.parse(await readFile(path,'utf8'));
  m.service.port=appPort;await writeFile(path,JSON.stringify(m));
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:bearer,ADA_INTERNAL_KEY:internal,
   ADA_CAPS:'network_anchor_transport.read,network_anchor_transport.send',ADA_PORT:String(corePort),APP_PORT:String(appPort)};
  app=spawn(process.execPath,[join(runtime,'apps/network_anchor_transport/service.mjs')],{env,stdio:['ignore','ignore','pipe']});
  core=spawn(process.execPath,[join(runtime,'core/kernel.mjs')],{env,stdio:['ignore','ignore','pipe']});
  app.stderr.on('data',x=>appError=(appError+x).slice(-1200));core.stderr.on('data',x=>coreError=(coreError+x).slice(-1200));
  let found;
  for(let i=0;i<140;i++){
   if(app.exitCode!==null||core.exitCode!==null)throw Error('unexpected_exit:'+appError+':'+coreError);
   try{const r=await fetch(base+'/api/graph',{headers:auth,signal:AbortSignal.timeout(500)});const v=await r.json();
    if(v.nodes?.some(n=>n.id==='network_anchor_transport.status')){found=v;break;}}catch{}await pause(75);
  }
  assert(found,'Core failed to discover only transport:'+appError+':'+coreError);
  assert(found.nodes.every(n=>n.id.startsWith('network_anchor_transport.')));
  assert(!found.nodes.some(n=>n.id==='network_anchor_transport.deliver'));
  assert.equal((await fetch(base+'/api/graph')).status,401);
  const invoke=async action=>fetch(base+'/api/invoke',{method:'POST',headers:{...auth,'Content-Type':'application/json'},
   body:JSON.stringify({action})});
  assert.equal((await invoke('network_anchor_transport.apply')).status,403);
  const status=await invoke('network_anchor_transport.status');assert.equal(status.status,200);
  const content=await status.json();assert.equal(content.result.configured,false);
  await stop(app);app=null;
  const after=await fetch(base+'/api/graph',{headers:auth});const g=await after.json();
  assert(g.nodes.every(n=>!n.id.startsWith('network_anchor_transport.')),'App hot revocation missing');
 }finally{await Promise.all([stop(core),stop(app)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
