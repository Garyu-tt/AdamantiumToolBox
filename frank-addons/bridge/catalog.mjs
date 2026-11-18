import {readdir,readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,join,relative,sep,isAbsolute} from 'node:path';
import {validSlug,validateFrankAddon} from './contract.mjs';
const inside=(base,child)=>{
 const rel=relative(base,child);
 return Boolean(rel)&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);
};
async function directories(base){
 try{return (await readdir(base,{withFileTypes:true}))
  .filter(item=>item.isDirectory()&&!item.isSymbolicLink()&&validSlug(item.name))
  .map(item=>item.name).sort();}
 catch(error){if(error.code==='ENOENT')return [];throw error;}
}
/** Read-only discovery. Does NOT execute, install or activate packages. */
export async function frankCatalog(projectRoot){
 const base=resolve(projectRoot,'frank-addons');
 const result=[];
 for(const language of await directories(base)){
  const languageDir=join(base,language);
  for(const id of await directories(languageDir)){
   const directory=join(languageDir,id);
   try{
    const marker=join(directory,'frank-addon.json');
    if(!(await lstat(marker)).isFile())continue;
    const manifest=JSON.parse(await readFile(marker,'utf8'));
    if(!validateFrankAddon(manifest,language,id))continue;
    const home=await realpath(directory);
    const entry=await realpath(resolve(home,manifest.entry));
    if(!inside(home,entry)||!(await lstat(entry)).isFile())continue;
    result.push({key:'frank.'+language+'.'+id,source:'frank-addon',
     language,id,directory,manifest,entry});
   }catch(error){
    if(['ENOENT','ENOTDIR','EACCES','SyntaxError'].includes(error.code)||error instanceof SyntaxError)continue;
    // A malformed optional addon must never prevent other addons loading.
    continue;
   }
  }
 }
 return result;
}
