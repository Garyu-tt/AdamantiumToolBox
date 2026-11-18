import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {identity,seal} from './identity.mjs';
import {packDir} from './bundle.mjs';
import {signedHeaders,trustedUrl} from './transport.mjs';
import {inventory,readEnvelope,receive} from './store.mjs';
async function config(root,name,fallback){
 try{return JSON.parse((await readFile(join(root,'mesh',name),'utf8')).replace(/^\uFEFF/,''));}
 catch(e){if(e.code==='ENOENT')return fallback;throw e;}
}
async function inbox(root,owner){
 const dir=join(root,'plugins','inbox');
 let found=[];try{found=await readdir(dir,{withFileTypes:true});}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const ownTrust={[owner.id]:{publicKey:owner.publicKey,receive:true}};
 let count=0;const errors=[];
 for(const item of found){
  if(!item.isDirectory()||item.isSymbolicLink())continue;
  try{
   const envelope=seal(await packDir(join(dir,item.name)),owner);
   const stored=await receive(root,envelope,ownTrust);
   if(!stored.already)count++;
  }catch(e){errors.push({plugin:item.name,error:String(e.message).slice(0,90)});}
 }
 return {count,errors};
}
async function remote(peer,owner,method,path,payload){
 const base=trustedUrl(peer.url);
 const url=new URL(path,base);
 const body=payload===undefined?'':JSON.stringify(payload);
 const headers={...signedHeaders(owner,method,url.pathname+url.search,body),
  'Content-Type':'application/json'};
 const res=await fetch(url,{method,headers,body:method==='POST'?body:undefined,
  signal:AbortSignal.timeout(5000)});
 const data=await res.json();
 if(!res.ok)throw Error('peer_'+res.status+':'+(data.error||'error'));
 return data;
}
export async function syncOnce(root){
 const owner=await identity(join(root,'mesh'));
 const trust=await config(root,'trust.json',{});
 const peers=await config(root,'peers.json',[]);
 const imported=await inbox(root,owner);
 let present=new Set(await inventory(root)),sent=0,pulled=0;
 const states=[];
 for(const peer of peers){
  if(!trust[peer.id]?.receive){states.push({id:peer.id,status:'untrusted'});continue;}
  try{
   const response=await remote(peer,owner,'GET','/v1/index');
   const hashes=response.hashes;
   if(response.schema!=='mas-mesh-index-1'||!Array.isArray(hashes)||hashes.length>10000)throw Error('invalid_peer_index');
   if(!hashes.every(h=>typeof h==='string'&&/^[0-9a-f]{64}$/.test(h)))throw Error('invalid_peer_hash');
   const their=new Set(hashes);
   for(const hash of present){
    if(their.has(hash))continue;
    await remote(peer,owner,'POST','/v1/package',await readEnvelope(root,hash));sent++;
   }
   for(const hash of their){
    if(present.has(hash))continue;
    const envelope=await remote(peer,owner,'GET','/v1/package/'+hash);
    if(envelope.hash!==hash)throw Error('hash_mismatch');
    await receive(root,envelope,trust);
    present.add(hash);pulled++;
   }
   states.push({id:peer.id,status:'synchronized'});
  }catch(e){states.push({id:peer.id,status:'unavailable',error:String(e.message).slice(0,85)});}
 }
 const state={schema:'mas-mesh-status-1',at:new Date().toISOString(),localNew:imported.count,inboxErrors:imported.errors,
  packages:present.size,sent,pulled,peers:states};
 await mkdir(join(root,'mesh'),{recursive:true});
 await writeFile(join(root,'mesh','status.json'),JSON.stringify(state,null,2));
 return state;
}
