import {readFile,realpath,readdir,lstat} from 'node:fs/promises';
import {join,resolve,relative,sep,isAbsolute} from 'node:path';
import {createHash,createPublicKey,verify} from 'node:crypto';
const h=v=>createHash('sha256').update(v).digest('hex');
const safeId=/^[a-z][a-z0-9_-]{1,39}$/;
const hashId=/^[0-9a-f]{64}$/;
const under=(base,file)=>{const rel=relative(base,file);return rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel);};
export async function activeDoc(runtime){
 try{
  const doc=JSON.parse((await readFile(join(runtime,'plugins','active.json'),'utf8')).replace(/^\uFEFF/,''));
  if(doc.schema!=='mas-active-1'||!Array.isArray(doc.apps)||doc.apps.length>80)throw Error('bad_active_registry');
  const ids=new Set();
  for(const a of doc.apps){
   if(!safeId.test(a.id)||!hashId.test(a.hash)||ids.has(a.id))throw Error('bad_active_entry');
   ids.add(a.id);
  }
  return doc;
 }catch(e){if(e.code==='ENOENT')return {schema:'mas-active-1',apps:[],history:[]};throw e;}
}
export async function verifiedPackage(runtime,item){
 const store=JSON.parse(await readFile(join(runtime,'plugins','store',item.hash+'.json'),'utf8'));
 const payload=store.payload;
 if(store.schema!=='mas-envelope-1'||store.hash!==item.hash||h(JSON.stringify(payload))!==item.hash)throw Error('hash_mismatch');
 const owner=JSON.parse((await readFile(join(runtime,'mesh','identity.json'),'utf8')).replace(/^\uFEFF/,''));
 let trusted={};
 try{trusted=JSON.parse((await readFile(join(runtime,'mesh','trust.json'),'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e.code!=='ENOENT')throw e;}
 const rule=store.origin===owner.id?{publicKey:owner.publicKey,receive:true,activate:true}:trusted[store.origin];
 if(!rule?.receive||!rule.activate||!rule.publicKey||!/^[-_A-Za-z0-9+/=]+$/.test(store.signature))throw Error('untrusted_activation');
 if(!verify(null,Buffer.from(item.hash),createPublicKey(rule.publicKey),Buffer.from(store.signature,'base64')))throw Error('bad_signature');
 if(payload?.schema!=='mas-package-1'||payload.id!==item.id||!payload.files?.['manifest.json'])throw Error('invalid_payload');
 const base=await realpath(join(runtime,'plugins','installed',item.hash));
 const parent=await realpath(join(runtime,'plugins','installed'));
 if(!under(parent,base))throw Error('outside_install_dir');
 const names=Object.keys(payload.files);
 for(const name of names){
  if(!name.split('/').every(x=>/^[a-z0-9][a-z0-9._-]*$/i.test(x)&&x!=='.'&&x!=='..'))throw Error('unsafe_file');
  const actual=await realpath(resolve(base,name));
  if(!under(base,actual)||!(await lstat(actual)).isFile())throw Error('unsafe_install_file');
  const data=await readFile(actual);
  if(data.toString('base64')!==payload.files[name])throw Error('tampered_install');
 }
 const present=[];
 async function walk(folder,prefix=''){
  for(const entry of await readdir(folder,{withFileTypes:true})){
   if(entry.isSymbolicLink())throw Error('unexpected_symlink');
   const path=prefix+entry.name;
   if(entry.isDirectory())await walk(join(folder,entry.name),path+'/');
   else if(entry.isFile())present.push(path);
   else throw Error('unexpected_file_type');
  }
 }
 await walk(base);
 if(present.length!==names.length||present.some(x=>!names.includes(x)))throw Error('unexpected_install_files');
 const manifest=JSON.parse(Buffer.from(payload.files['manifest.json'],'base64').toString('utf8'));
 if(manifest.id!==item.id)throw Error('wrong_app');
 return {manifest,directory:base,hash:item.hash,assets:names};
}
