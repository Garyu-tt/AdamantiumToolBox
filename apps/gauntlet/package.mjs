import {hash} from './shared.mjs';
const names=/^[a-z0-9][a-z0-9._-]*$/i;
const extensions=new Set(['json','mjs','js','ts','css','html','svg','png','ico','md','py','wasm']);
export function stagePackage(c){
 const source=c?.files;
 if(!source||Array.isArray(source)||typeof source!=='object')throw Error('bad_sources');
 const keys=Object.keys(source).sort();
 if(keys.length<3||keys.length>120||!['manifest.json','service.mjs','view.js']
   .every(name=>keys.includes(name)))throw Error('required_files_missing');
 const encoded={};
 for(const name of keys){
  if(name.includes('..')||name.startsWith('/')||name.includes('\\')||
   !name.split('/').every(part=>names.test(part)))throw Error('unsafe_path');
  if(!extensions.has(name.split('.').at(-1).toLowerCase()))throw Error('unsupported_extension');
  if(typeof source[name]!=='string')throw Error('bad_source_value');
  encoded[name]=Buffer.from(source[name],'utf8').toString('base64');
 }
 const manifest=JSON.parse(source['manifest.json']);
 if(manifest.id!==c.plugin_id)throw Error('plugin_mismatch');
 const payload={schema:'mas-package-1',id:manifest.id,version:manifest.version,files:encoded};
 return {payload,mesh_payload_sha256:hash(JSON.stringify(payload))};
}
