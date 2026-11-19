import {readFile,mkdir,writeFile,rename,copyFile,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialize,validate} from './model.mjs';
const file=()=>process.env.MIKOSHI_TRANSITIONS_STATE||'';
export const configured=()=>Boolean(file());
export async function load(){
 if(!configured())return initialize();
 try{
  const data=await readFile(file(),'utf8');
  if(data.length>100000)throw Error('transition_state_too_large');
  const state=JSON.parse(data);validate(state);return state;
 }catch(e){if(e.code==='ENOENT')return initialize();throw e;}
}
export async function save(s){
 if(!configured())throw Error('transition_storage_not_configured');
 validate(s);await mkdir(dirname(file()),{recursive:true,mode:0o700});
 const temp=file()+'.'+randomUUID()+'.tmp';
 await writeFile(temp,JSON.stringify(s),{mode:0o600,flag:'wx'});
 try{
  await copyFile(file(),file()+'.previous').catch(e=>{
   if(e.code!=='ENOENT')throw e;
  });
  await rename(temp,file());
 }catch(e){await rm(temp,{force:true});throw e;}
}
