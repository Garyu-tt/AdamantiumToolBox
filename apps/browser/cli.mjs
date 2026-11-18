import {readFile,writeFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {provider,hostKey,clientKey} from './provider.mjs';
import {identity} from './continuity.mjs';
const home=process.env.LOCALAPPDATA||process.env.HOME;
if(!home)throw Error('missing_user_profile');
const runtime=join(home,'Adamantium Toolbox'),folder=join(runtime,'browser');
const [cmd,arg,flag]=process.argv.slice(2),approve=process.argv.includes('--approve');
async function atomic(path,value){
 await mkdir(folder,{recursive:true});
 const temp=path+'.'+randomUUID();
 try{await writeFile(temp,value,{flag:'wx',mode:0o600});await rename(temp,path);}
 finally{await rm(temp,{force:true});}
}
async function run(){
 if(cmd==='status'){
  const mode=await provider(runtime);
  const host=await hostKey(runtime);
  const client=await clientKey(runtime).catch(e=>e.message==='relay_client_key_missing'?null:Promise.reject(e));
  const ident=await identity(runtime);
  return {schema:'mas-browser-status-1',mode:mode.mode,
   identity:ident.id,hostRelayEnabled:!!host,clientConfigured:!!client,
   endpoint:mode.mode==='relay'?mode.endpoint:null,credentialsExported:false};
 }
 if(!approve)throw Error('explicit_approval_required');
 if(cmd==='host-enable'){
  if(await hostKey(runtime))return {alreadyEnabled:true,restartRequired:false};
  await mkdir(folder,{recursive:true});
  const file=join(folder,'relay-host-key');
  await writeFile(file,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});
  return {hostRelayEnabled:true,restartRequired:true,secretNeverDisplayed:true};
 }
 if(cmd==='client-import'){
  if(typeof arg!=='string'||!arg)throw Error('key_file_required');
  const source=resolve(arg);
  const info=await stat(source);
  if(!info.isFile()||info.size>128)throw Error('invalid_key_file');
  const value=(await readFile(source,'utf8')).trim();
  if(!/^[0-9a-f]{64}$/.test(value))throw Error('invalid_key_file');
  await atomic(join(folder,'relay-client-key'),value);
  return {clientConfigured:true,secretNeverDisplayed:true,restartRequired:true};
 }
 if(cmd==='use-relay'){
  const port=Number(arg);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalid_tunnel_port');
  await clientKey(runtime);
  const endpoint=new URL('/','http://'+(process.env.ADA_LOOPBACK_HOST||'127.0.0.1')+':'+port).origin;
  await atomic(join(folder,'provider.json'),JSON.stringify({
   schema:'mas-browser-provider-1',mode:'relay',endpoint}));
  return {mode:'relay',endpoint,restartRequired:true};
 }
 if(cmd==='use-local'){
  await atomic(join(folder,'provider.json'),JSON.stringify({
   schema:'mas-browser-provider-1',mode:'local'}));
  return {mode:'local',restartRequired:true};
 }
 return {commands:['status','host-enable --approve',
  'client-import <private-key-file> --approve',
  'use-relay <local-ssh-forward-port> --approve','use-local --approve']};
}
try{console.log(JSON.stringify(await run(),null,2));}
catch(e){console.error('BROWSER_PROVIDER_ERROR '+e.message);process.exitCode=1;}
