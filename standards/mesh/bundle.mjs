import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateManifest} from '../../core/contract.mjs';
const names=/^[a-z0-9][a-z0-9._-]*$/i;
const extensions=new Set(['.json','.mjs','.js','.ts','.css','.html','.svg','.png','.ico','.md','.py','.wasm']);
const MAX_BYTES=8*1024*1024,MAX_FILES=120;
export const digest=data=>createHash('sha256').update(data).digest('hex');
export function validatePayload(payload){
 if(payload?.schema!=='mas-package-1'||!payload.files||typeof payload.files!=='object')throw Error('invalid_package');
 const keys=Object.keys(payload.files).sort();
 if(!keys.length||keys.length>MAX_FILES||!keys.includes('manifest.json')||!keys.includes('service.mjs')||!keys.includes('view.js'))throw Error('missing_files');
 let bytes=0;
 for(const name of keys){
  if(!name.split('/').every(segment=>names.test(segment))||name.includes('..')||name.startsWith('/')||name.includes('\\'))throw Error('unsafe_path');
  if(!extensions.has('.'+name.split('.').pop().toLowerCase()))throw Error('unsupported_extension');
  const encoded=payload.files[name];
  if(typeof encoded!=='string'||encoded.length>MAX_BYTES*2||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw Error('invalid_content');
  const data=Buffer.from(encoded,'base64');
  if(data.toString('base64')!==encoded)throw Error('noncanonical_content');
  bytes+=data.length;
  if(bytes>MAX_BYTES)throw Error('package_too_large');
 }
 const manifest=JSON.parse(Buffer.from(payload.files['manifest.json'],'base64').toString('utf8'));
 if(!validateManifest(manifest)||manifest.id!==payload.id||manifest.version!==payload.version)throw Error('invalid_manifest');
 return {manifest,bytes};
}
export async function packDir(folder){
 const files={},base=resolve(folder);
 async function collect(dir){
  for(const ent of await readdir(dir,{withFileTypes:true})){
   if(ent.isSymbolicLink()||!names.test(ent.name))throw Error('unsafe_entry');
   const full=join(dir,ent.name),name=relative(base,full).split('\\').join('/');
   const info=await lstat(full);
   if(info.isDirectory()){await collect(full);continue;}
   if(!info.isFile()||info.size>MAX_BYTES)throw Error('invalid_file');
   if(Object.keys(files).length>=MAX_FILES)throw Error('too_many_files');
   files[name]=(await readFile(full)).toString('base64');
  }
 }
 await collect(base);
 const parsed=JSON.parse(Buffer.from(files['manifest.json']||'','base64').toString('utf8'));
 const payload={schema:'mas-package-1',id:parsed.id,version:parsed.version,files:Object.fromEntries(Object.entries(files).sort())};
 validatePayload(payload);return payload;
}
