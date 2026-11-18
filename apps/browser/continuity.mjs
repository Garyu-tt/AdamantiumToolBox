import {mkdir,readFile,writeFile,open,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const valid=v=>v?.schema==='mas-browser-identity-1'&&
 typeof v.id==='string'&&/^[0-9a-f-]{36}$/.test(v.id);
export async function identity(runtime){
 const dir=join(runtime,'browser');await mkdir(dir,{recursive:true});
 const file=join(dir,'identity.json');
 let state;try{state=JSON.parse(await readFile(file,'utf8'));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 if(!state){
  const next={schema:'mas-browser-identity-1',id:randomUUID(),createdAt:new Date().toISOString()};
  try{await writeFile(file,JSON.stringify(next),{flag:'wx',mode:0o600});state=next;}
  catch(e){if(e.code!=='EEXIST')throw e;state=JSON.parse(await readFile(file,'utf8'));}
 }
 if(!valid(state))throw Error('browser_identity_invalid');
 return {id:state.id,profile:join(dir,'profiles',state.id)};
}
export async function lease(profile){
 await mkdir(profile,{recursive:true,mode:0o700});
 const lockfile=join(profile,'.mas-active');
 let handle;
 for(let tries=0;tries<2&&!handle;tries++){
  try{handle=await open(lockfile,'wx',0o600);}catch(e){
   if(e.code!=='EEXIST')throw e;
   let pid;
   try{pid=JSON.parse(await readFile(lockfile,'utf8')).pid;}catch{}
   if(!Number.isInteger(pid)||pid<1)throw Error('browser_lease_needs_review');
   try{process.kill(pid,0);throw Error('browser_profile_already_owned');}
   catch(check){
    if(check.code!=='ESRCH')throw check;
   }
   await unlink(lockfile).catch(e=>{if(e.code!=='ENOENT')throw e;});
  }
 }
 if(!handle)throw Error('browser_profile_lock_race');
 await handle.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));
 return async()=>{await handle.close();await unlink(lockfile).catch(()=>{});};
}
