import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { catalog } from './catalog.mjs';
import { serviceCatalog } from './services.mjs';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const profile=process.env.LOCALAPPDATA;
if(!profile)throw Error('No user profile');
const auth=JSON.parse(readFileSync(join(profile,'Adamantium Toolbox','auth.json'),'utf8').replace(/^\uFEFF/,''));
process.env.ADA_TOKEN=auth.token;
process.env.ADA_INTERNAL_KEY=auth.internal;
const policy=JSON.parse(readFileSync(join(profile,'Adamantium Toolbox','policy.json'),'utf8').replace(/^\uFEFF/,''));
if(policy.schema!=='mas-owner-policy-1'||!Array.isArray(policy.capabilities)||
 !policy.capabilities.every(p=>typeof p==='string'&&/^[a-z0-9_-]+\.[a-z0-9_-]+$/.test(p)))throw Error('Invalid owner policy');
process.env.ADA_CAPS=[...new Set(policy.capabilities)].join(',');
process.env.ADA_CORE_URL=process.env.ADA_CORE_URL||'http://127.0.0.1:'+(process.env.ADA_PORT||8880);
const children=new Map(),failures=new Map();
function start(key,file,env={}){
 const instance=spawn(process.execPath,[file],{cwd:root,env:{...process.env,...env},windowsHide:true,stdio:'ignore'});
 const entry={instance,started:Date.now(),file,env};
 children.set(key,entry);
 instance.on('exit',()=>{
  if(children.get(key)!==entry)return;
  children.delete(key);
  const count=Date.now()-entry.started>30000?0:(failures.get(key)||0)+1;
  failures.set(key,count);
  if(count<=5)setTimeout(()=>{if(!children.has(key))start(key,file,env);},2000*count);
 });
}
async function discover(){
 const entries=await catalog(root),system=await serviceCatalog(root);
 const wanted=new Set([...entries.map(a=>'app:'+a.id),...system.map(s=>'service:'+s.id)]);
 for(const [key,entry] of children)if(key!=='kernel'&&!wanted.has(key)){
  children.delete(key);entry.instance.kill();
 }
 for(const service of system){
  const key='service:'+service.id;
  if(!children.has(key))start(key,service.entry);
 }
 for(const app of entries){
  const key='app:'+app.id;
  if(!children.has(key))start(key,join(root,'apps',app.id,'service.mjs'),{APP_PORT:String(app.service.port)});
 }
}
start('kernel',join(root,'core','kernel.mjs'));
await discover();
setInterval(()=>discover().catch(()=>{}),5000);
process.on('SIGTERM',()=>{for(const e of children.values())e.instance.kill();process.exit(0);});
