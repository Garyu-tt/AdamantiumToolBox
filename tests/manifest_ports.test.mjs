import {strict as assert} from 'node:assert';
import {readdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ports=new Map(),names=new Set();
for(const family of ['apps','plugins']){
 const entries=await readdir(join(root,family),{withFileTypes:true});
 for(const entry of entries){
  if(!entry.isDirectory()||entry.isSymbolicLink())continue;
  let manifest;
  try{manifest=JSON.parse(await readFile(join(root,family,entry.name,'manifest.json'),'utf8'));}
  catch(e){if(e.code==='ENOENT')continue;throw e;}
  const id=manifest.id,port=manifest.service?.port,source=family+'/'+entry.name;
  assert(typeof id==='string'&&id===entry.name,'invalid_manifest_id:'+source);
  assert(!names.has(id),'duplicate_manifest_id:'+id);names.add(id);
  assert(Number.isInteger(port)&&port>=1024&&port<=65535,'invalid_port:'+source);
  assert(!ports.has(port),`port_conflict:${port}:${ports.get(port)}:${source}`);
  ports.set(port,source);
 }
}
console.log('MAS_MANIFEST_PORTS_OK',ports.size,'unique ports');
