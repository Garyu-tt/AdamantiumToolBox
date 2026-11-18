import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
const keyPattern=/^[0-9a-f]{64}$/;
const file=(runtime,name)=>join(runtime,'browser',name);
export async function provider(runtime){
 let p;try{p=JSON.parse(await readFile(file(runtime,'provider.json'),'utf8'));}
 catch(e){if(e.code==='ENOENT')return {schema:'mas-browser-provider-1',mode:'local'};throw e;}
 if(p?.schema!=='mas-browser-provider-1')throw Error('invalid_browser_provider');
 if(p.mode==='local')return {schema:p.schema,mode:'local'};
 if(p.mode!=='relay'||typeof p.endpoint!=='string')throw Error('invalid_browser_provider');
 let u;try{u=new URL(p.endpoint);}catch{throw Error('invalid_relay_endpoint');}
 if(u.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(u.hostname)||
  !u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)
  throw Error('relay_requires_local_ssh_tunnel');
 return {schema:p.schema,mode:'relay',endpoint:u.origin};
}
async function readKey(runtime,name){
 try{const key=(await readFile(file(runtime,name),'utf8')).trim();
  if(!keyPattern.test(key))throw Error('invalid_relay_key');return key;}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export async function hostKey(runtime){return readKey(runtime,'relay-host-key');}
export async function clientKey(runtime){
 const key=await readKey(runtime,'relay-client-key');
 if(!key)throw Error('relay_client_key_missing');return key;
}
export function authorizedHost(expected,provided){
 if(!expected||typeof provided!=='string'||!keyPattern.test(provided))return false;
 return timingSafeEqual(Buffer.from(expected),Buffer.from(provided));
}
export async function relayInvoke(runtime,provider,action,params){
 const key=await clientKey(runtime);
 const res=await fetch(provider.endpoint+'/invoke',{method:'POST',redirect:'error',
  headers:{'X-Browser-Relay-Key':key,'Content-Type':'application/json'},
  body:JSON.stringify({action,params}),signal:AbortSignal.timeout(18000)});
 const max=2000000;if(Number(res.headers.get('content-length'))>max)throw Error('relay_too_large');
 const chunks=[];let length=0;
 for await(const chunk of res.body){length+=chunk.length;
  if(length>max)throw Error('relay_too_large');chunks.push(chunk);}
 let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch{throw Error('relay_bad_response');}
 if(!res.ok)throw Error('relay_failed_'+res.status+':'+String(data.error||''));
 return data.result;
}
