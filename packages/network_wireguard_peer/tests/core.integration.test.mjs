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
const appSource=join(repo,'packages','network_wireguard_peer');
const token='isolated-core-token-long-enough-24',secret='isolated-app-secret-long-enough-24';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const free=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
async function stop(c){if(!c||c.exitCode!==null)return;const e=once(c,'exit').catch(()=>{});c.kill();await Promise.race([e,pause(3000)])}
test('Core + network_wireguard_peer only; authenticated and dynamically revoked',{timeout:30000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'wg-peer-core-')),runtime=join(tmp,'repo'),home=join(tmp,'home');
 const corePort=await free(),appPort=await free();
 let core,app,err='';
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});
  await mkdir(join(runtime,'interface'),{recursive:true});
  await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});
  await cp(appSource,join(runtime,'apps','network_wireguard_peer'),{recursive:true});
  const manifestPath=join(runtime,'apps','network_wireguard_peer','manifest.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));manifest.service.port=appPort;
  await writeFile(manifestPath,JSON.stringify(manifest));
  const mock=join(tmp,'wg-mock');
  await writeFile(mock,'#!/usr/bin/env node\nif(process.argv[2]==="show")process.stdout.write("");else process.exit(2);\n');
  await chmod(mock,0o700);
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,ADA_INTERNAL_KEY:secret,
   ADA_CAPS:'network_wireguard_peer.read,network_wireguard_peer.write',ADA_PORT:String(corePort),
   APP_PORT:String(appPort),NETWORK_WG_BIN:mock,NETWORK_WG_IFACE:'wg0',NETWORK_WG_POOL:'10.222.33.0/24'};
  core=spawn(process.execPath,[join(runtime,'core','kernel.mjs')],{env,stdio:['ignore','ignore','pipe']});
  app=spawn(process.execPath,[join(runtime,'apps','network_wireguard_peer','service.mjs')],{env,stdio:['ignore','ignore','pipe']});
  core.stderr.on('data',b=>err+=b);app.stderr.on('data',b=>err+=b);
  const base='http://127.0.0.1:'+corePort,headers={Authorization:'Bearer '+token};
  let graph;
  for(let i=0;i<160;i++){
   if(core.exitCode!==null||app.exitCode!==null)throw Error('early_exit '+err.slice(-400));
   try{
    const r=await fetch(base+'/api/graph',{headers,signal:AbortSignal.timeout(700)});
    if(r.ok){const data=await r.json();if(data.nodes.some(n=>n.id==='network_wireguard_peer.prepare')){graph=data;break;}}
   }catch{}await pause(100);
  }
  assert(graph,'Core did not discover peer plugin: '+err.slice(-500));
  assert(graph.nodes.every(n=>n.id.startsWith('network_wireguard_peer.')));
  assert(!graph.nodes.some(n=>n.id==='network_wireguard_peer.apply'));
  assert.equal((await fetch(base+'/api/graph')).status,401);
  const req=await fetch(base+'/api/invoke',{method:'POST',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({action:'network_wireguard_peer.status',params:{}})});
  assert.equal(req.status,200);
  const apply=await fetch(base+'/api/invoke',{method:'POST',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({action:'network_wireguard_peer.apply',params:{}})});
  assert.equal(apply.status,403);
  await stop(app);app=null;
  const gone=await (await fetch(base+'/api/graph',{headers})).json();
  assert(gone.nodes.every(n=>!n.id.startsWith('network_wireguard_peer.')));
 }finally{await Promise.all([stop(core),stop(app)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
});
