import {mkdir,readFile,readdir,writeFile,rename,rm,stat} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validatePayload} from './bundle.mjs';
import {trustEnvelope} from './identity.mjs';
const rootPath=root=>resolve(root);
export async function inventory(root){
 const dir=join(rootPath(root),'plugins','store');
 let names=[];try{names=await readdir(dir);}catch(e){if(e.code!=='ENOENT')throw e;}
 return names.filter(n=>/^[0-9a-f]{64}\.json$/.test(n)).map(n=>n.slice(0,-5)).sort();
}
export async function readEnvelope(root,hash){
 if(!/^[0-9a-f]{64}$/.test(hash))throw Error('bad_hash');
 const data=await readFile(join(rootPath(root),'plugins','store',hash+'.json'),'utf8');
 return JSON.parse(data.replace(/^\uFEFF/,''));
}
export async function receive(root,envelope,trust){
 const {manifest,rule}=trustEnvelope(envelope,trust);
 const dir=join(rootPath(root),'plugins','store');
 await mkdir(dir,{recursive:true});
 const path=join(dir,envelope.hash+'.json');
 try{await stat(path);return {hash:envelope.hash,id:manifest.id,already:true};}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const tmp=path+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(envelope),{flag:'wx'});
 await rename(tmp,path);
 return {hash:envelope.hash,id:manifest.id,activate:rule.autoActivate===true};
}
export async function unpack(root,envelope,trust){
 const {manifest}=trustEnvelope(envelope,trust);
 const stage=join(rootPath(root),'plugins','staging',manifest.id+'-'+randomUUID());
 await mkdir(stage,{recursive:true});
 try{
  for(const [name,b64] of Object.entries(envelope.payload.files)){
   const path=resolve(stage,name);
   if(!path.startsWith(stage+sep))throw Error('unsafe_entry');
   await mkdir(resolve(path,'..'),{recursive:true});
   await writeFile(path,Buffer.from(b64,'base64'),{flag:'wx'});
  }
  const installed=join(rootPath(root),'plugins','installed');
  await mkdir(installed,{recursive:true});
  const target=join(installed,envelope.hash);
  await rename(stage,target);
  return {target,id:manifest.id,hash:envelope.hash};
 }catch(e){await rm(stage,{recursive:true,force:true});throw e;}
}
