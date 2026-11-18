import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const idPattern=/^[a-z][a-z0-9_-]{1,39}$/;
export async function discoverModules(base,app){
 const nodes=[{id:'genesis.view',type:'view',title:app.name,icon:app.icon,
  requires:['genesis.read']}],edges=[],actions=new Map();
 async function visit(directory,parent){
  let entries;
  try{entries=await readdir(directory,{withFileTypes:true});}
  catch(e){if(e.code==='ENOENT')return;throw e;}
  for(const entry of entries){
   if(!entry.isDirectory()||entry.isSymbolicLink()||!idPattern.test(entry.name))continue;
   const folder=join(directory,entry.name);let def;
   try{def=JSON.parse(await readFile(join(folder,'module.json'),'utf8'));}
   catch(e){if(e.code==='ENOENT'){await visit(folder,parent);continue;}throw e;}
   if(def.enabled===false)continue;
   if(def.id!==entry.name||!idPattern.test(def.id)||!Array.isArray(def.actions))throw Error('bad_module');
   const id=parent==='genesis.view'?'genesis.module.'+def.id:parent+'.'+def.id;
   nodes.push({id,type:'resource',title:def.name||def.id,requires:['genesis.read'],
    capability:def.capability||null});
   edges.push({from:parent,to:id,type:'contains'});
   const handler=await import(pathToFileURL(join(folder,'handler.mjs')).href);
   if(typeof handler.invoke!=='function')throw Error('missing_handler');
   for(const operation of def.actions){
    if(typeof operation.id!=='string'||!/^genesis\.[a-z0-9_.-]+$/.test(operation.id)||
       actions.has(operation.id)||!app.permissions.includes(operation.permission))throw Error('bad_action');
    const node={id:operation.id,type:'action',title:operation.title||operation.id,
     requires:[operation.permission],inputs:operation.inputs||[]};
    nodes.push(node);edges.push({from:id,to:node.id,type:'uses'});
    actions.set(operation.id,{permission:operation.permission,invoke:handler.invoke});
   }
   await visit(folder,id);
  }
 }
 await visit(join(base,'modules'),'genesis.view');
 return {graph:{app:'genesis',version:1,nodes,edges},actions};
}
