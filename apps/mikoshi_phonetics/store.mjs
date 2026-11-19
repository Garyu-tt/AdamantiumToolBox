import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialize} from './learner.mjs';
const file=()=>process.env.MIKOSHI_PHONETICS_STATE||'';
export const configured=()=>Boolean(file());
export function anchor(){
 const raw=process.env.MIKOSHI_PHONETICS_ANCHOR_HZ;
 const n=raw===undefined?235:Number(raw);
 if(!Number.isFinite(n)||n<170||n>340)throw Error('pitch_anchor');
 return n;
}
export async function load(){
 if(!configured())return initialize(anchor());
 try{
  const value=JSON.parse(await readFile(file(),'utf8'));
  if(value.anchorHz!==anchor())throw Error('pitch_identity_mismatch');
  return value;
 }catch(e){
  if(e.code==='ENOENT')return initialize(anchor());
  throw e;
 }
}
export async function save(state){
 if(!configured())throw Error('learning_storage_not_configured');
 await mkdir(dirname(file()),{recursive:true,mode:0o700});
 const tmp=file()+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(state),{mode:0o600,flag:'wx'});
 await rename(tmp,file());
}
