import {readFile,mkdir,writeFile,rename,copyFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialize,catalog} from './cluster.mjs';
const path=()=>process.env.MIKOSHI_MOTIFS_STATE||'';
export const configured=()=>Boolean(path());
export async function load(){
 if(!configured())return initialize();
 try{
  const raw=await readFile(path(),'utf8');
  if(raw.length>240000)throw Error('motif_state_too_large');
  const state=JSON.parse(raw);catalog(state);return state;
 }catch(e){if(e.code==='ENOENT')return initialize();throw e;}
}
export async function save(state){
 if(!configured())throw Error('motif_storage_not_configured');
 catalog(state);
 await mkdir(dirname(path()),{recursive:true,mode:0o700});
 const tmp=path()+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(state),{mode:0o600,flag:'wx'});
 try{
  await copyFile(path(),path()+'.previous').catch(e=>{
   if(e.code!=='ENOENT')throw e;
  });
  await rename(tmp,path());
 }catch(e){const {rm}=await import('node:fs/promises');await rm(tmp,{force:true});throw e;}
}
