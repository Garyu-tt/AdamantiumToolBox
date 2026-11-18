import {readdir,readFile,realpath,stat} from 'node:fs/promises';
import {resolve,join,basename,relative,isAbsolute,sep} from 'node:path';
const idPattern=/^[a-z][a-z0-9_-]{1,39}$/;
const pathPattern=/^[a-z0-9_./-]+\.mjs$/i;
const contained=(root,target)=>{
 const rel=relative(root,target);
 return rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel);
};
export async function serviceCatalog(root){
 const folder=resolve(root,'services');
 let entries;
 try{entries=await readdir(folder,{withFileTypes:true});}
 catch(e){if(e.code==='ENOENT')return [];throw e;}
 if(entries.length>128)throw Error('service_limit');
 const result=[],rootReal=await realpath(root);
 for(const entry of entries){
  if(!entry.name.endsWith('.json'))continue;
  if(!entry.isFile()||entry.isSymbolicLink())throw Error('invalid_service_entry');
  const id=basename(entry.name,'.json');
  if(!idPattern.test(id))throw Error('invalid_service_id');
  const doc=JSON.parse(await readFile(join(folder,entry.name),'utf8'));
  if(doc.schema!=='mas-system-service-1'||doc.id!==id||doc.runtime!=='node'||
    typeof doc.entry!=='string'||!pathPattern.test(doc.entry)||
    doc.entry.split('/').some(s=>s==='.'||s==='..'||s===''))throw Error('invalid_service_manifest');
  if(doc.enabled===false)continue;
  if(doc.enabled!==true)throw Error('invalid_enabled_flag');
  const path=await realpath(resolve(root,doc.entry));
  if(!contained(rootReal,path)||!(await stat(path)).isFile())throw Error('service_escape');
  result.push({id,entry:path});
 }
 return result.sort((a,b)=>a.id.localeCompare(b.id));
}
