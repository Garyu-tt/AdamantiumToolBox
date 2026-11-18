import {mkdir,open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {activeDoc} from '../../core/plugin_sources.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function current(runtime){
 const doc=await activeDoc(runtime);
 return {...doc,revision:digest(doc)};
}
export async function locked(runtime,fn){
 const folder=join(runtime,'plugins');await mkdir(folder,{recursive:true});
 const file=join(folder,'.lifecycle.lock');
 let lock;try{lock=await open(file,'wx');}catch(e){
  if(e.code==='EEXIST')throw Error('lifecycle_locked');throw e;
 }
 try{return await fn();}
 finally{await lock.close();await unlink(file).catch(()=>{});}
}
export async function save(runtime,before,apps,event){
 const now=await current(runtime);
 if(now.revision!==before.revision)throw Error('stale_revision');
 if(!Array.isArray(apps)||apps.length>80)throw Error('invalid_active_apps');
 const history=[...(before.history||[]),event].slice(-100);
 const doc={schema:'mas-active-1',apps:apps.sort((a,b)=>a.id.localeCompare(b.id)),history};
 const path=join(runtime,'plugins','active.json');
 const temp=path+'.'+randomUUID()+'.tmp';
 try{
  await writeFile(temp,JSON.stringify(doc,null,2),{flag:'wx'});
  await rename(temp,path);
 }finally{await unlink(temp).catch(()=>{});}
 return {revision:digest(doc),event};
}
