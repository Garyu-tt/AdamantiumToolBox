import {readFile,mkdir,writeFile,rename,copyFile,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialize,validate} from './model.mjs';
const path=()=>process.env.MIKOSHI_MOTOR_STATE||'';
export const configured=()=>Boolean(path());
export async function load(){
 if(!configured())return initialize();
 try{
  const raw=await readFile(path(),'utf8');
  if(raw.length>180000)throw Error('motor_state_too_large');
  const state=JSON.parse(raw);validate(state);return state;
 }catch(e){if(e.code==='ENOENT')return initialize();throw e;}
}
export async function save(state){
 if(!configured())throw Error('motor_storage_not_configured');
 validate(state);await mkdir(dirname(path()),{recursive:true,mode:0o700});
 const temp=path()+'.'+randomUUID()+'.tmp';
 await writeFile(temp,JSON.stringify(state),{mode:0o600,flag:'wx'});
 try{
  await copyFile(path(),path()+'.previous').catch(e=>{
   if(e.code!=='ENOENT')throw e;
  });
  await rename(temp,path());
 }catch(e){await rm(temp,{force:true});throw e;}
}
