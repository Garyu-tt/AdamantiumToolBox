import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {free,pause,stop} from './fixture.mjs';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const source=join(repo,'packages/network_checkpoint');
const secret='checkpoint-core-internal-secret-long',token='checkpoint-core-bearer-token-long';
test('Core + network_checkpoint alone discovers only status, denies writes and revokes stopped app',{timeout:30000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'checkpoint-core-'));
 const runtime=join(tmp,'runtime'),home=join(tmp,'home'),corePort=await free(),appPort=await free();
 let core,app;
 const base='http://127.0.0.1:'+corePort;
 const bearer={Authorization:'Bearer '+token};
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});await mkdir(join(runtime,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});await cp(source,join(runtime,'apps/network_checkpoint'),{recursive:true});
  const mp=join(runtime,'apps/network_checkpoint/manifest.json'),m=JSON.parse(await readFile(mp,'utf8'));
  m.service.port=appPort;await writeFile(mp,JSON.stringify(m));
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,ADA_INTERNAL_KEY:secret,
   ADA_CAPS:'network_checkpoint.read,network_checkpoint.deliver',ADA_PORT:String(corePort),APP_PORT:String(appPort)};
  app=spawn(process.execPath,[join(runtime,'apps/network_checkpoint/service.mjs')],{env,stdio:'ignore'});
  core=spawn(process.execPath,[join(runtime,'core/kernel.mjs')],{env,stdio:'ignore'});
  let graph;for(let i=0;i<125;i++){if(app.exitCode!==null||core.exitCode!==null)throw Error('early_exit');
   try{const r=await fetch(base+'/api/graph',{headers:bearer});const g=await r.json();
    if(g.nodes?.some(n=>n.id==='network_checkpoint.status')){graph=g;break;}}catch{}await pause(80);}
  assert(graph,'Core failed to discover standalone checkpoint app');
  assert(graph.nodes.every(n=>n.id.startsWith('network_checkpoint.')));
  assert(!graph.nodes.some(n=>n.id==='network_checkpoint.deliver'));
  assert.equal((await fetch(base+'/api/graph')).status,401);
  const r=await fetch(base+'/api/invoke',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},
   body:JSON.stringify({action:'network_checkpoint.deliver'})});assert.equal(r.status,403);
  await stop(app);app=null;
  const after=await (await fetch(base+'/api/graph',{headers:bearer})).json();
  assert(after.nodes.every(n=>!n.id.startsWith('network_checkpoint.')));
 }finally{await Promise.all([stop(core),stop(app)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
