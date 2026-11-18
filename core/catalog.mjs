import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateManifest} from './contract.mjs';
export async function catalog(root){
 const apps=[],ports=new Set();
 let dirs=[];try{dirs=await readdir(resolve(root,'apps'),{withFileTypes:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const dir of dirs){
  if(!dir.isDirectory()||dir.isSymbolicLink())continue;
  try{
   const m=JSON.parse(await readFile(resolve(root,'apps',dir.name,'manifest.json'),'utf8'));
   if(!validateManifest(m)||m.id!==dir.name||ports.has(m.service.port))continue;
   ports.add(m.service.port);apps.push(m);
  }catch{}
 }
 return apps;
}
