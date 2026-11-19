import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialize} from './network.mjs';
const path=()=>process.env.MIKOSHI_PROSODY_STATE||null;
export const configured=()=>Boolean(path());
export async function load(){
 if(!configured())throw Error('prosody_storage_not_configured');
 try{return JSON.parse(await readFile(path(),'utf8'));}
 catch(e){if(e.code==='ENOENT')return initialize();throw e;}
}
export async function save(state){
 if(!configured())throw Error('prosody_storage_not_configured');
 await mkdir(dirname(path()),{recursive:true,mode:0o700});
 const temp=path()+'.'+randomUUID()+'.tmp';
 await writeFile(temp,JSON.stringify(state),{mode:0o600,flag:'wx'});
 await rename(temp,path());
}
