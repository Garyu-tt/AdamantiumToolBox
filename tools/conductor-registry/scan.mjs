import {readdir,readFile} from 'node:fs/promises';
import {relative,resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';

const ignored=new Set(['.git','node_modules','.next','dist','coverage']);
const names=new Set(['manifest.json','frank-addon.json']);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// The registry reads a source tree, never the MAS installation/activation store.
export async function scan(root,source){
 const base=resolve(root),raw=[];
 async function walk(dir,depth){
  if(depth>32)throw Error('source_tree_too_deep');
  const entries=(await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){
   if(entry.isSymbolicLink())continue;
   const path=join(dir,entry.name);
   if(entry.isDirectory()&&!ignored.has(entry.name))await walk(path,depth+1);
   if(entry.isFile()&&names.has(entry.name)){
    const bytes=await readFile(path);
    if(bytes.length>65536){raw.push({path,invalid:'manifest_too_large'});continue;}
    let data;
    try{data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}
    catch{raw.push({path,invalid:'invalid_json'});continue;}
    const rel=relative(base,path).split(sep).join('/');
    if(entry.name==='manifest.json'&&data.mas!=='1.0')continue;
    if(entry.name==='frank-addon.json'&&data.schema!=='frank-addon-1')continue;
    raw.push({data,path:rel,hash:sha(bytes),kind:entry.name==='manifest.json'?'mas':'frank'});
   }
  }
 }
 await walk(base,0);
 return {source:{type:source.type||'repository_checkout',ref:source.ref||null,
  uri:source.uri||null,read_only:true},raw};
}