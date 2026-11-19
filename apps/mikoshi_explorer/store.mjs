import {readFile,mkdir,writeFile,rename,copyFile,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialize,validate} from './model.mjs';
const path=()=>process.env.MIKOSHI_EXPLORER_STATE||'';
export const configured=()=>Boolean(path());
export async function load(){
 if(!configured())return initialize();
 try{
  const raw=await readFile(path(),'utf8');
  if(raw.length>18000)throw Error('exploration_state_too_large');
  const result=JSON.parse(raw);validate(result);return result;
 }catch(e){if(e.code==='ENOENT')return initialize();throw e;}
}
export async function save(state){
 if(!configured())throw Error('exploration_storage_not_configured');
 validate(state);
 await mkdir(dirname(path()),{recursive:true,mode:0o700});
 const tmp=path()+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(state),{mode:0o600,flag:'wx'});
 try{
  await copyFile(path(),path()+'.previous').catch(e=>{
   if(e.code!=='ENOENT')throw e;
  });
  await rename(tmp,path());
 }catch(e){await rm(tmp,{force:true});throw e;}
}
