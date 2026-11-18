import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, cp, readFile, writeFile, rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const appSource=join(repo,'packages','network_fabric');
const token='test-token-long-enough-to-satisfy-24';
const secret='test-internal-key-long-enough-24';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});});
async function stop(child){if(!child||child.exitCode!==null)return;const exit=once(child,'exit').catch(()=>{});child.kill('SIGTERM');await Promise.race([exit,pause(3000)]);}
async function response(url,headers={}){const r=await fetch(url,{headers,signal:AbortSignal.timeout(900)});return {status:r.status,body:await r.json()};}
const bearer={Authorization:'Bearer '+token};
test('real Core + network_fabric, no other MAS apps or graphical provider', {timeout:30000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'network-fabric-core-'));
 const runtime=join(tmp,'repo'),home=join(tmp,'home');
 const corePort=await freePort(),appPort=await freePort();
 const host='http://127.0.0.1:'+corePort;
 let core,app;const logs={core:'',app:''};
 try {
  await mkdir(join(runtime,'apps'),{recursive:true});await mkdir(join(runtime,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});
  await cp(appSource,join(runtime,'apps','network_fabric'),{recursive:true});
  const manifest=join(runtime,'apps','network_fabric','manifest.json');
  const m=JSON.parse(await readFile(manifest,'utf8'));m.service.port=appPort;
  await writeFile(manifest,JSON.stringify(m));
  const state=join(tmp,'state.json');
  await writeFile(state,JSON.stringify({schema:'network-fabric-state-v1',revision:'core-integration',
   nodes:[{id:'laptop',online:true,secret:'never-return'},{id:'server',online:true}],
   links:[{from:'laptop',to:'server',cost:1,up:true}],policies:[],approvals:[],trust:{}}));
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,ADA_INTERNAL_KEY:secret,
   ADA_CAPS:'network_fabric.read,network_fabric.evaluate',ADA_PORT:String(corePort),APP_PORT:String(appPort),NETWORK_FABRIC_STATE:state};
  app=spawn(process.execPath,[join(runtime,'apps','network_fabric','service.mjs')],{env,stdio:['ignore','ignore','pipe']});
  core=spawn(process.execPath,[join(runtime,'core','kernel.mjs')],{env,stdio:['ignore','ignore','pipe']});
  for(const [name,child] of [['core',core],['app',app]])child.stderr.on('data',d=>logs[name]=(logs[name]+d).slice(-2000));
  let graph;
  for(let i=0;i<120;i++) {
   if(core.exitCode!==null||app.exitCode!==null)throw Error('early_exit '+JSON.stringify(logs));
   try {const g=await response(host+'/api/graph',bearer);if(g.status===200 && g.body.nodes.some(n=>n.id==='network_fabric.topology')){graph=g.body;break;}}
   catch {}await pause(100);
  }
  assert(graph,'Core did not discover Network Fabric: '+JSON.stringify(logs));
  assert(graph.nodes.length>=4);
  assert(graph.nodes.every(n=>n.id.startsWith('network_fabric.')),'A different app was required');
  assert.equal((await response(host+'/api/graph')).status,401,'Core must require authentication');
  const list=await fetch(host+'/api/invoke',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},
   body:JSON.stringify({action:'network_fabric.topology'})});
  assert.equal(list.status,200);const content=await list.text();
  assert(!content.includes('never-return'),'Core leaked private state');
  assert(content.includes('laptop'));
  const deny=await fetch(host+'/api/invoke',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},
   body:JSON.stringify({action:'network_fabric.apply'})});
  assert.equal(deny.status,403,'No network mutation must be executable');
  await stop(app);app=null;
  const after=await response(host+'/api/graph',bearer);
  assert(after.body.nodes.every(n=>!n.id.startsWith('network_fabric.')),'Unavailable app not revoked');
 }finally {await Promise.all([stop(core),stop(app)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
