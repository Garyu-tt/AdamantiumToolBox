import {readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {validateManifest} from './contract.mjs';
import {activeDoc,verifiedPackage} from './plugin_sources.mjs';
export async function catalog(root){
 const apps=[],ports=new Set(),ids=new Set();
 let dirs=[];try{dirs=await readdir(resolve(root,'apps'),{withFileTypes:true});}
 catch(e){if(e.code!=='ENOENT')throw e;}
 for(const dir of dirs){
  if(!dir.isDirectory()||dir.isSymbolicLink())continue;
  try{
   const directory=resolve(root,'apps',dir.name);
   const m=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
   if(!validateManifest(m)||m.id!==dir.name||ports.has(m.service.port))continue;
   ports.add(m.service.port);ids.add(m.id);apps.push({...m,directory,source:'bundled'});
  }catch{}
 }
 const home=process.env.LOCALAPPDATA;
 if(!home)return apps;
 const runtime=join(home,'Adamantium Toolbox');
 let selected=[];
 try{selected=(await activeDoc(runtime)).apps;}catch{return apps;}
 for(const item of selected){
  if(ids.has(item.id))continue;
  try{
   const {manifest:m,directory,assets}=await verifiedPackage(runtime,item);
   if(!validateManifest(m)||m.id!==item.id||ports.has(m.service.port))continue;
   ports.add(m.service.port);ids.add(m.id);apps.push({...m,directory,source:'plugin',hash:item.hash,assets});
  }catch{}
 }
 return apps;
}
