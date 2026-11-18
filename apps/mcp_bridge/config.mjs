import {readFile,stat} from 'node:fs/promises';
import {createPublicKey} from 'node:crypto';
const name=/^[a-z][a-z0-9_-]{1,39}$/;
const envName=/^ADA_[A-Z0-9_]+$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function allowedUrl(raw){
 const u=new URL(raw);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('unsafe_endpoint');
 const local=['127.0.0.1','[::1]','localhost'].includes(u.hostname);
 if(u.protocol!=='https:'&&!(local&&u.protocol==='http:'))throw Error('https_required');
 return u.origin;
}
function pinnedIdentity(value){
 if(value===undefined)return null; // Legacy: discovery reports unverified; invocation is blocked.
 if(!value||!uuid.test(value.id)||typeof value.publicKey!=='string'||value.publicKey.length>2000)throw Error('invalid_mesh_identity');
 try{if(createPublicKey(value.publicKey).asymmetricKeyType!=='ed25519')throw Error('not_ed25519');}
 catch{throw Error('invalid_mesh_identity');}
 return {id:value.id,publicKey:value.publicKey};
}
export function validate(raw){
 if(raw?.schema!=='adamantium.bridge.nodes.v1'||!Array.isArray(raw.nodes)||raw.nodes.length>128)throw Error('bad_registry');
 const ids=new Set();
 return raw.nodes.map(x=>{
  if(!name.test(x.id)||ids.has(x.id)||x.approved!==true)throw Error('unapproved_node');
  if(!Array.isArray(x.urls)||!x.urls.length||x.urls.length>8)throw Error('bad_endpoints');
  if(!envName.test(x.tokenEnv)||!Array.isArray(x.allow)||!x.allow.every(a=>/^[a-z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(a)))throw Error('bad_policy');
  if(x.allow.length>256)throw Error('too_many_actions');
  ids.add(x.id);
  return {id:x.id,urls:[...new Set(x.urls.map(allowedUrl))],tokenEnv:x.tokenEnv,
   allow:new Set(x.allow),identity:pinnedIdentity(x.identity)};
 });
}
export async function nodes(env=process.env){
 if(env.ADA_BRIDGE_CONFIG){
  if((await stat(env.ADA_BRIDGE_CONFIG)).size>262144)throw Error('registry_too_large');
  const raw=JSON.parse(await readFile(env.ADA_BRIDGE_CONFIG,'utf8'));
  return validate(raw);
 }
 if(!env.ADA_CORE_URL||!env.ADA_TOKEN)throw Error('core_bootstrap_unavailable');
 return validate({schema:'adamantium.bridge.nodes.v1',nodes:[{
  id:'self',approved:true,urls:[env.ADA_CORE_URL.replace(/\/?$/,'/')],tokenEnv:'ADA_TOKEN',allow:[]
 }]});
}
export function credential(n,env=process.env){
 const token=env[n.tokenEnv];if(typeof token!=='string'||token.length<24)throw Error('credential_missing');
 return token;
}
