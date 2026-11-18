import {readdir,readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const MAX_DEPTH=8,MAX_ENTRIES=800;
const suffix='.appref.json';
export async function linkTree(root,backend){
 const base=resolve(root,'interface'),views=new Map(backend.nodes.filter(n=>n.type==='view').map(n=>[n.id,n]));
 let seen=0;const referenced=new Set();
 async function folder(path,depth){
  const children=[];
  if(depth>MAX_DEPTH)return children;
  let entries;try{entries=await readdir(path,{withFileTypes:true});}
  catch(e){if(e.code==='ENOENT')return children;throw e;}
  entries.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  for(const entry of entries){
   if(++seen>MAX_ENTRIES)break;
   const target=join(path,entry.name);
   if(entry.isDirectory()&&!entry.isSymbolicLink()){
    children.push({type:'folder',name:entry.name,children:await folder(target,depth+1)});
   }else if(entry.isFile()&&entry.name.endsWith(suffix)){
    let ref;try{
     if((await stat(target)).size>4096)continue;
     ref=JSON.parse(await readFile(target,'utf8'));
    }catch{continue;}
    const view=views.get(ref?.view);
    if(!view||ref.schema!=='mas-appref-1'||ref.app!==ref.view.split('.')[0])continue;
    const name=entry.name.slice(0,-suffix.length);
    if(!name||name.startsWith('.'))continue;
    referenced.add(view.id);children.push({type:'app',name,view:view.id,icon:view.icon});
   }
  }
  return children;
 }
 const children=await folder(base,0);
 const unlinked=[...views.values()].filter(v=>!referenced.has(v.id))
  .map(v=>({type:'app',name:v.title||v.id,view:v.id,icon:v.icon}));
 return {schema:'mas-linkfs-1',root:'interface',children:[...children,...unlinked]};
}
