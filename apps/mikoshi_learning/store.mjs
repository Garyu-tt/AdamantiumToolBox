import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const path=()=>process.env.MIKOSHI_LEARNING_STATE||null;
export const configured=()=>Boolean(path());
export async function load(){
 if(!configured())return {schema:'mikoshi.prototypes.v1',items:[]};
 try{
  const state=JSON.parse(await readFile(path(),'utf8'));
  if(state.schema!=='mikoshi.prototypes.v1'||!Array.isArray(state.items))
   throw Error('invalid_state_schema');
  return state;
 }catch(e){
  if(e.code==='ENOENT')return {schema:'mikoshi.prototypes.v1',items:[]};
  throw e;
 }
}
export async function save(state){
 if(!configured())throw Error('learning_storage_not_configured');
 await mkdir(dirname(path()),{recursive:true,mode:0o700});
 const tmp=path()+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(state),{mode:0o600,flag:'wx'});
 await rename(tmp,path());
}
