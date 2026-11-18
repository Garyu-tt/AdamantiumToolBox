import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const token='test-bearer-secure-long-enough';
const key='test-internal-key-long-enough';
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
async function stop(child){if(!child||child.exitCode!==null)return;const gone=once(child,'exit').catch(()=>{});child.kill('SIGTERM');await Promise.race([gone,wait(3000)]);}
async function json(base,path,auth=false){const r=await fetch(base+path,{headers:auth?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(1000)});return {status:r.status,data:await r.json()};}
async function invoke(base,action,params={}){
 const r=await fetch(base+'/api/invoke',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,params}),signal:AbortSignal.timeout(1200)});
 return {status:r.status,data:await r.json()};
}
test('isolated Core + network_policy without other apps, denied writes and live revocation',{timeout:30000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'mas-network_policy-'));
 const folder=join(tmp,'runtime'),home=join(tmp,'home');let core,app;
 const corePort=await free(),appPort=await free();const base='http://127.0.0.1:'+corePort;
 const logs={core:'',app:''};
 try{
  await mkdir(join(folder,'apps'),{recursive:true});await mkdir(join(folder,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(folder,'core'),{recursive:true});
  await cp(join(repo,'packages','network_policy'),join(folder,'apps','network_policy'),{recursive:true});
  const file=join(folder,'apps','network_policy','manifest.json');const m=JSON.parse(await readFile(file,'utf8'));m.service.port=appPort;await writeFile(file,JSON.stringify(m));
  const state=join(tmp,'state.json');await writeFile(state,JSON.stringify({"schema": "network-fabric-state-v1", "revision": "rev1", "policies": [], "approvals": [], "trust": {}}));
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,ADA_INTERNAL_KEY:key,ADA_CAPS:'network_policy.read,network_policy.evaluate',ADA_PORT:String(corePort),APP_PORT:String(appPort),NETWORK_POLICY_STATE:state};
  app=spawn(process.execPath,[join(folder,'apps','network_policy','service.mjs')],{env,stdio:['ignore','ignore','pipe']});
  core=spawn(process.execPath,[join(folder,'core','kernel.mjs')],{env,stdio:['ignore','ignore','pipe']});
  for(const [name,child] of [['core',core],['app',app]])child.stderr.on('data',d=>logs[name]=(logs[name]+d).slice(-1200));
  let g;
  for(let i=0;i<120;i++){
   if(core.exitCode!==null||app.exitCode!==null)throw Error('early_exit '+JSON.stringify(logs));
   try{const q=await json(base,'/api/graph',true);if(q.status===200&&q.data.nodes.some(n=>n.id==='network_policy.proposal')){g=q.data;break;}}catch{}await wait(100);
  }
  assert(g,'graph_not_ready '+JSON.stringify(logs));
  assert(g.nodes.every(n=>n.id.startsWith('network_policy.')),'another app was required');
  assert.equal((await json(base,'/api/graph')).status,401);
  const planned=await invoke(base,'network_policy.proposal',{flow:{source:'desktop',destination:'server',principal:'owner',protocol:'tcp',port:443},revision:'rev1',expiresAt:new Date(Date.now()+3600000).toISOString()});
  assert.equal(planned.status,200,JSON.stringify(planned.data));
  assert(!JSON.stringify(planned).includes('hidden-private-key'));
  assert.equal((await invoke(base,'network_policy.apply',{command:'sudo ip route add'})).status,403,'nonexistent apply rejected');
  await stop(app);app=null;
  const after=await json(base,'/api/graph',true);
  assert(after.data.nodes.every(n=>!n.id.startsWith('network_policy.')),'hot revocation failed');
 }finally{await Promise.all([stop(app),stop(core)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
