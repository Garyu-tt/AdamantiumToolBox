import {readdir,readFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateModule} from './contract.mjs';
const validAction=/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
export async function loadModules(root,{policy={},context={}}={}){
 const discovered=[],status=[],services=new Map(),actions=new Map(),registered=new Set(),versions=new Map();
 const compatible=r=>{const v=versions.get(r.name);if(!v)return false;const [ma,mi]=v.split('.').map(Number),[ra,ri]=r.version.split('.').map(Number);return ma===ra&&mi>=ri;};
 async function visit(folder,parent='',parentOn=true){
  let dirs;try{dirs=await readdir(folder,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
  for(const d of dirs){
   if(!d.isDirectory()||d.isSymbolicLink())continue;
   const path=join(folder,d.name),name=[parent,d.name].filter(Boolean).join('.');
   let m;try{m=JSON.parse(await readFile(join(path,'module.json'),'utf8'));}catch{status.push({name,state:'invalid_manifest'});continue;}
   if(!validateModule(m,d.name)){status.push({name,state:'invalid_manifest'});continue;}
   const enabled=parentOn&&policy[name]!==false&&m.enabled!==false;
   if(!enabled){status.push({name,state:'disabled'});continue;}
   if(m.isolation==='dedicated'){status.push({name,state:'unsupported_isolation'});continue;}
   discovered.push({name,m,path});
   await visit(join(path,'modules'),name,enabled);
  }
 }
 await visit(resolve(root));
 let pending=discovered;
 while(pending.length){
  let progress=false,next=[];
  for(const mod of pending){
   const {name,m,path}=mod;
   if(!m.requires.every(compatible)){next.push(mod);continue;}
   progress=true;
   try{
    const file=m.entry?join(path,m.entry):null;
    if(file&&!(await lstat(file)).isFile())throw Error('entry_missing');
    const factory=file?(await import(pathToFileURL(file).href)).activate:null;
    if(file&&typeof factory!=='function')throw Error('missing_activate');
    const result=factory?await factory({ ...context, use:c=>services.get(c),name,settings:m.settings||{} }):{services:{},actions:{}};
    const svc=result?.services||{},act=result?.actions||{};
    for(const desc of m.provides){
     if(registered.has(desc.name))throw Error('duplicate_capability');
     if(desc.action&&!validAction.test(desc.action))throw Error('bad_action');
     if(desc.action&&actions.has(desc.action))throw Error('duplicate_action');
     if(desc.action&&typeof act[desc.action]!=='function')throw Error('missing_action');
     if(!desc.action&&!(desc.name in svc))throw Error('missing_service');
    }
    for(const desc of m.provides){
     if(desc.action)actions.set(desc.action,{run:act[desc.action],permission:desc.permission||'',name:desc.name,owner:name,
      version:desc.version,operation:desc.operation});
     else services.set(desc.name,svc[desc.name]);
     versions.set(desc.name,desc.version);registered.add(desc.name);
    }
    status.push({name,state:'active',isolation:m.isolation,capabilities:m.provides.map(c=>c.name)});
   }catch(e){status.push({name,state:'failed',reason:String(e.message).slice(0,100)});}
  }
  if(!progress){for(const m of next)status.push({name:m.name,state:'blocked',requires:m.m.requires.filter(x=>!compatible(x))});break;}
  pending=next;
 }
 return {status,actions,services};
}
