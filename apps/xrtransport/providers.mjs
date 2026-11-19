import {readFile,readdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const key=/^[a-z][a-z0-9_-]{1,39}$/;
const root=join(import.meta.dirname,'adapters');
export async function adapters(){
 const found=[];
 for(const dir of await readdir(root,{withFileTypes:true})){
  if(!dir.isDirectory()||!key.test(dir.name))continue;
  try{
   const folder=join(root,dir.name),stat=await lstat(join(folder,'probe.mjs'));
   if(!stat.isFile()||stat.isSymbolicLink())continue;
   const doc=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
   if(doc.id!==dir.name||doc.schema!=='xr-provider-1'||
    typeof doc.name!=='string'||doc.name.length>80||doc.name.length===0)continue;
   found.push({...doc,entry:join(folder,'probe.mjs')});
  }catch{}
 }
 return found.sort((a,b)=>a.id.localeCompare(b.id));
}
async function configuration(){
 const file=process.env.XR_PROVIDERS_FILE;
 if(!file)return {items:[],notice:'provider_registry_not_configured'};
 try{
  const items=JSON.parse(await readFile(file,'utf8'));
  if(!Array.isArray(items)||items.length>20)throw Error('invalid');
  const ids=new Set();
  for(const x of items){
   if(!x||!key.test(x.id)||!key.test(x.adapter)||ids.has(x.id)||
    typeof x.label!=='string'||!x.label||x.label.length>80)throw Error('invalid');
   ids.add(x.id);
  }
  return {items,notice:null};
 }catch{return {items:[],notice:'provider_registry_invalid'};}
}
export async function providers(){
 const docs=await adapters(),cfg=await configuration();
 const known=new Map(docs.map(d=>[d.id,d]));
 const entries=await Promise.all(cfg.items.map(async item=>{
  const doc=known.get(item.adapter);
  if(!doc)return {id:item.id,label:item.label,adapter:item.adapter,state:'adapter_missing'};
  try{
   const driver=await import(pathToFileURL(doc.entry).href);
   const result=await driver.probe({...item},doc);
   return {id:item.id,label:item.label,adapter:doc.id,category:doc.category,
    ...result,launchable:false};
  }catch{return {id:item.id,label:item.label,adapter:doc.id,
   category:doc.category,state:'probe_failed',launchable:false};}
 }));
 return {providers:entries,adapters:docs.map(({entry,...doc})=>doc),notice:cfg.notice,
  note:'server_or_process_observed_does_not_imply_streaming_or_pairing'};
}
