import {validateManifest} from '../core/contract.mjs';
const id=/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const ver=/^\d+\.\d+\.\d+$/;
const range=/^\^?\d+\.\d+\.\d+$/;
const types=new Set(['view','action','resource','event']);
const kinds=new Set(['module','submodule','component']);
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fail=reason=>{throw Error('modules_'+reason);};
export function validateModules(doc,manifest){
 if(!validateManifest(manifest))fail('bad_mas_manifest');
 if(!obj(doc)||doc.schema!=='mas-modules-1'||doc.app!==manifest.id||
  !Array.isArray(doc.modules))fail('bad_document');
 const modules=new Set(),capabilities=new Set(),seen=new WeakSet();
 let count=0;
 function walk(m){
  if(!obj(m)||seen.has(m)||++count>4096)fail('invalid_tree');
  seen.add(m);
  if(!id.test(m.id)||!m.id.startsWith(manifest.id+'.')||modules.has(m.id)||
   !kinds.has(m.kind)||!ver.test(m.version||'0.0.0')||
   (m.enabled!==undefined&&typeof m.enabled!=='boolean'))fail('invalid_module');
  modules.add(m.id);
  for(const field of ['provides','consumes','links','children'])
   if(m[field]!==undefined&&!Array.isArray(m[field]))fail('invalid_'+field);
  for(const p of m.provides||[]){
   if(!obj(p)||!id.test(p.id)||!p.id.startsWith(manifest.id+'.')||
    capabilities.has(p.id)||!types.has(p.type)||!ver.test(p.version)||
    typeof p.title!=='string'||!p.title||p.title.length>100||
    !Array.isArray(p.permissions)||!p.permissions.every(s=>manifest.permissions.includes(s)))
    fail('invalid_capability');
   if(p.type==='action'&&(!obj(p.input)||!obj(p.output)))fail('untyped_action');
   capabilities.add(p.id);
  }
  for(const c of m.consumes||[]){
   if(!obj(c)||!id.test(c.id)||!range.test(c.version)||
    typeof c.optional!=='boolean'||
    (!c.id.startsWith(manifest.id+'.')&&!c.optional))fail('invalid_dependency');
  }
  for(const e of m.links||[])
   if(!obj(e)||!id.test(e.from)||!id.test(e.to)||
    typeof e.type!=='string'||!e.type)fail('invalid_edge');
  for(const child of m.children||[])walk(child);
 }
 for(const module of doc.modules)walk(module);
 return {modules:modules.size,capabilities:capabilities.size};
}
