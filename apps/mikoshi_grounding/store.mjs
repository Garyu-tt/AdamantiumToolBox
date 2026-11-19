import {readFile,mkdir,writeFile,rename,copyFile,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialize,validate} from './model.mjs';
const path=()=>process.env.MIKOSHI_GROUNDING_STATE||'';
export const configured=()=>Boolean(path());
export async function load(){
 if(!configured())return initialize();
 try{
  const raw=await readFile(path(),'utf8');
  if(raw.length>180000)throw Error('grounding_state_too_large');
  const s=JSON.parse(raw);validate(s);return s;
 }catch(e){if(e.code==='ENOENT')return initialize();throw e;}
}
export async function save(s){
 if(!configured())throw Error('grounding_storage_not_configured');
 validate(s);await mkdir(dirname(path()),{recursive:true,mode:0o700});
 const tmp=path()+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(s),{mode:0o600,flag:'wx'});
 try{
  await copyFile(path(),path()+'.previous').catch(e=>{
   if(e.code!=='ENOENT')throw e;
  });
  await rename(tmp,path());
 }catch(e){await rm(tmp,{force:true});throw e;}
}
