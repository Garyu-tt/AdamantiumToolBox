import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const root=join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','graphs');
const path=join(root,'frontend.json');
const empty={frontend:{version:1,nodes:[],edges:[]},bridge:{version:1,edges:[]}};
const checksum=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function loadFrontend(){
 try{const doc=JSON.parse(await readFile(path,'utf8'));return {...doc,etag:checksum(doc)};}
 catch(e){if(e.code!=='ENOENT')throw e;return {...structuredClone(empty),etag:checksum(empty)};}
}
export function validateFrontend(doc){
 if(!doc?.frontend||!doc.bridge||doc.frontend.version!==1||doc.bridge.version!==1)throw Error('bad_schema');
 const {nodes,edges}=doc.frontend,links=doc.bridge.edges;
 if(!Array.isArray(nodes)||nodes.length>220||!Array.isArray(edges)||edges.length>600||!Array.isArray(links)||links.length>220)throw Error('graph_size');
 const found=new Map();
 for(const n of nodes){
  if(typeof n.id!=='string'||!/^f\.[a-z0-9._-]{1,65}$/.test(n.id)||found.has(n.id)||!['tab','button','label','connector'].includes(n.kind))throw Error('bad_node');
  if(typeof n.title!=='string'||n.title.length>100)throw Error('bad_title');
  if(n.kind!=='tab'&&(!Number.isInteger(n.x)||!Number.isInteger(n.y)||n.x<0||n.y<0||n.x>2500||n.y>2500))throw Error('bad_position');
  found.set(n.id,n.kind);
 }
 for(const e of edges)if(e.type!=='contains'||found.get(e.from)!=='tab'||!['button','label','connector'].includes(found.get(e.to)))throw Error('bad_edge');
 for(const e of links)if(e.type!=='invokes'||!['button','connector'].includes(found.get(e.from))||typeof e.to!=='string'||!/^([a-z0-9_-]+\.)+[a-z0-9_-]+$/.test(e.to))throw Error('bad_binding');
 return true;
}
let queue=Promise.resolve();
export function saveFrontend(input,options={}){
 const pending=queue.then(()=>commit(input,options));
 queue=pending.catch(()=>{});
 return pending;
}
async function commit(input,options){
 const before=await loadFrontend();
 if(input.etag!==before.etag)throw Error('graph_conflict');
 const history=Array.isArray(before.history)?before.history:[];
 if(options.audit&&(!options.audit.id||!options.audit.diff||history.length>500))throw Error('invalid_audit');
 const doc={frontend:input.frontend,bridge:input.bridge,history:options.audit?[...history,options.audit]:history};
 validateFrontend(doc);
 await mkdir(root,{recursive:true});
 const tmp=path+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(doc,null,2),'utf8');
 await rename(tmp,path);
 return {etag:checksum(doc)};
}
