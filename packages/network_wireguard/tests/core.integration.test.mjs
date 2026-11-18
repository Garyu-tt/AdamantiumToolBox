import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,chmod,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const appSource=join(repo,'packages','network_wireguard');
const token='test-token-long-enough-to-satisfy-24';
const secret='test-internal-key-long-enough-24';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});});
async function stop(child){if(!child||child.exitCode!==null)return;const exit=once(child,'exit').catch(()=>{});child.kill('SIGTERM');await Promise.race([exit,pause(3000)]);}
const bearer={Authorization:'Bearer '+token};
test('Core + WireGuard Provider independent, authenticated, hot-revoked',{timeout:30000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'wg-provider-core-'));const runtime=join(tmp,'repo'),home=join(tmp,'home');
 const corePort=await freePort(),appPort=await freePort(),host='http://127.0.0.1:'+corePort;
 let core,app;let errors='';
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});await mkdir(join(runtime,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});
  await cp(appSource,join(runtime,'apps','network_wireguard'),{recursive:true});
  const manifest=join(runtime,'apps','network_wireguard','manifest.json');
  const m=JSON.parse(await readFile(manifest,'utf8'));m.service.port=appPort;await writeFile(manifest,JSON.stringify(m));
  const mock=join(tmp,'wg-stub');await writeFile(mock,'#!/usr/bin/env node\nprocess.stdout.write("");\n');await chmod(mock,0o700);
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,ADA_INTERNAL_KEY:secret,
   ADA_CAPS:'network_wireguard.read',ADA_PORT:String(corePort),APP_PORT:String(appPort),NETWORK_WG_BIN:mock};
  core=spawn(process.execPath,[join(runtime,'core','kernel.mjs')],{env,stdio:['ignore','ignore','pipe']});
  app=spawn(process.execPath,[join(runtime,'apps','network_wireguard','service.mjs')],{env,stdio:['ignore','ignore','pipe']});
  core.stderr.on('data',d=>errors+=d);app.stderr.on('data',d=>errors+=d);
  let graph;
  for(let i=0;i<160;i++){
   if(core.exitCode!==null||app.exitCode!==null)throw Error('early_exit '+errors.slice(-1000));
   try{const r=await fetch(host+'/api/graph',{headers:bearer,signal:AbortSignal.timeout(750)});if(r.ok){const g=await r.json();if(g.nodes.some(n=>n.id==='network_wireguard.peers')){graph=g;break;}}}catch{}await pause(100);
  }
  assert(graph,'Core did not discover independent WireGuard provider: '+errors.slice(-1000));
  assert(graph.nodes.every(n=>n.id.startsWith('network_wireguard.')),'Another plugin unexpectedly required');
  assert.equal((await fetch(host+'/api/graph')).status,401);
  const invoke=async(action)=>fetch(host+'/api/invoke',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},body:JSON.stringify({action})});
  assert.equal((await invoke('network_wireguard.interfaces')).status,200);
  assert.equal((await invoke('network_wireguard.apply')).status,403);
  await stop(app);app=null;
  const after=await (await fetch(host+'/api/graph',{headers:bearer})).json();
  assert(after.nodes.every(n=>!n.id.startsWith('network_wireguard.')),'revoked action remains visible');
 }finally{await Promise.all([stop(core),stop(app)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
