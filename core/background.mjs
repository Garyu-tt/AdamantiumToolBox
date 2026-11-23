import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog} from './catalog.mjs';
import {serviceCatalog} from './services.mjs';
import {RuntimeGuard,loadRuntimePolicy,readGuard,persistGuard} from './runtime_guard.mjs';
import {automaticRollback} from '../standards/lifecycle/apply.mjs';
import {validateGraph} from './contract.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=process.env.LOCALAPPDATA;if(!home)throw Error('No user profile');
const runtime=join(home,'Adamantium Toolbox');
const auth=JSON.parse(readFileSync(join(runtime,'auth.json'),'utf8').replace(/^\uFEFF/,''));
process.env.ADA_TOKEN=auth.token;process.env.ADA_INTERNAL_KEY=auth.internal;
const owner=JSON.parse(readFileSync(join(runtime,'policy.json'),'utf8').replace(/^\uFEFF/,''));
if(owner.schema!=='mas-owner-policy-1'||!Array.isArray(owner.capabilities)||
 !owner.capabilities.every(p=>typeof p==='string'&&/^[a-z0-9_-]+\.[a-z0-9_-]+$/.test(p)))
 throw Error('Invalid owner policy');
if(owner.runtimeProfile!==undefined&&!['full','backend'].includes(owner.runtimeProfile))
 throw Error('Invalid runtime profile');
process.env.ADA_RUNTIME_PROFILE=owner.runtimeProfile||'full';
process.env.ADA_CAPS=[...new Set(owner.capabilities)].join(',');
process.env.ADA_CORE_URL=process.env.ADA_CORE_URL||'http://127.0.0.1:'+(process.env.ADA_PORT||8880);
const policy=await loadRuntimePolicy(root,runtime);
let saved;
try{
 saved=await readGuard(runtime);
 if(saved.schema!=='mas-runtime-guard-1'||!saved.entries||
 typeof saved.entries!=='object')throw Error('invalid_guard_state');
}catch(e){console.error('guard_state_recovery',e.message);
 saved={schema:'mas-runtime-guard-1',entries:{}};}
const guard=new RuntimeGuard(policy,saved.entries),children=new Map();
let persisting=Promise.resolve(),busy=false,stopping=false;
const persist=()=>{persisting=persisting.then(()=>persistGuard(runtime,guard)).catch(e=>console.error('guard_save',e.message));};
const failure=entry=>{guard.fail(entry.fingerprint);persist();};
function start(key,file,env={},fingerprint=key){
 const child=spawn(process.execPath,[file],{cwd:root,env:{...process.env,...env},windowsHide:true,stdio:'ignore'});
 const entry={child,file,env,fingerprint,started:Date.now()};
 children.set(key,entry);child.on('error',e=>console.error('spawn',key,e.code));
 child.on('close',()=>{if(children.get(key)!==entry||stopping)return;
  children.delete(key);failure(entry);});
}
function stop(key){
 const entry=children.get(key);if(!entry)return;
 children.delete(key);entry.child.kill();
}
const fingerprint=(app)=>'app:'+app.id+'@'+(app.hash||'bundled:'+app.version);
async function healthy(app,entry){
 if(Date.now()-entry.started<policy.startupGraceMs)return true;
 const host=new URL('/','http://'+(process.env.ADA_LOOPBACK_HOST||'127.0.0.1')+':'+app.service.port).origin;
 const options={signal:AbortSignal.timeout(policy.healthTimeoutMs)};
 const health=await fetch(host+'/health',options);
 if(!health.ok||(await health.json()).app!==app.id)throw Error('unhealthy');
 const graph=await fetch(host+'/graph',{signal:AbortSignal.timeout(policy.healthTimeoutMs),
  headers:{'X-Internal-Key':process.env.ADA_INTERNAL_KEY}});
 if(!graph.ok||!validateGraph(await graph.json(),app))throw Error('bad_graph');
 guard.healthy(entry.fingerprint);return true;
}
async function poll(){
 if(!children.has('kernel')&&guard.allowed('kernel'))
  start('kernel',join(root,'core','kernel.mjs'));
 const apps=await catalog(root),system=await serviceCatalog(root);
 const wanted=new Set(['kernel',...apps.map(a=>'app:'+a.id),...system.map(a=>'service:'+a.id)]);
 for(const key of children.keys())if(!wanted.has(key))stop(key);
 for(const service of system){
  const key='service:'+service.id,f='service:'+service.id+'@'+service.entry;
  const old=children.get(key);
  if(old&&(old.file!==service.entry))stop(key);
  if(!children.has(key)&&guard.allowed(f))start(key,service.entry,{},f);
 }
 for(const app of apps){
  const key='app:'+app.id,file=join(app.directory,'service.mjs');
  const env={APP_PORT:String(app.service.port)},f=fingerprint(app);
  const old=children.get(key);
  if(old&&(old.file!==file||old.env.APP_PORT!==env.APP_PORT))stop(key);
  const now=children.get(key);
  if(now){try{await healthy(app,now);}catch{if(children.get(key)===now){stop(key);failure(now);}}}
  const state=guard.get(f);
  if(state.blocked&&app.source==='plugin'&&policy.autoRollback&&!state.attempted){
   guard.attempted(f);persist();
   try{const result=await automaticRollback(root,runtime,app.id,app.hash);
    console.error('plugin_rollback',app.id,result.state);}
   catch(e){console.error('plugin_rollback_failed',app.id,e.message);}
  }
  if(!children.has(key)&&guard.allowed(f))start(key,file,env,f);
 }
}
start('kernel',join(root,'core','kernel.mjs'));
async function tick(){if(busy||stopping)return;busy=true;
 try{await poll();}catch(e){console.error('supervisor_poll',e.message);}
 finally{busy=false;}}
await tick();
setInterval(tick,policy.checkIntervalMs);
process.on('SIGTERM',()=>{stopping=true;for(const key of children.keys())stop(key);process.exit(0);});
