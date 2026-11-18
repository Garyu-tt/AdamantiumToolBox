import {mkdir,readFile,readdir,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash,publicView,validTask} from './shared.mjs';
const key=id=>{if(!validTask(id))throw Error('invalid_task_id');return hash(id);};
export async function load(root,id){
 try{return JSON.parse(await readFile(join(root,'cases',key(id)+'.json'),'utf8'));}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export async function store(root,c){
 const dir=join(root,'cases');await mkdir(dir,{recursive:true});
 const target=join(dir,key(c.task_id)+'.json'),temp=target+'.'+randomUUID();
 await writeFile(temp,JSON.stringify(c));await rename(temp,target);
}
export async function put(root,type,keypart,value){
 const dir=join(root,type);await mkdir(dir,{recursive:true});
 const name=hash(JSON.stringify(value))+'.json';
 try{await writeFile(join(dir,name),JSON.stringify(value),{flag:'wx'});}
 catch(e){if(e.code!=='EEXIST')throw e;}
 return name;
}
export async function list(root){
 let names=[];try{names=await readdir(join(root,'cases'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const cases=[];
 for(const name of names.filter(n=>n.endsWith('.json'))){
  try{cases.push(publicView(JSON.parse(await readFile(join(root,'cases',name),'utf8'))));}catch{}
 }
 return cases.sort((a,b)=>a.task_id.localeCompare(b.task_id));
}
export async function blocker(root,c,issues){
 const report={schema:'gauntlet-diagnostic-1',task_id:c.task_id,
  sha256:c.sha256,attempt:c.attempts,issues,qa_evidence:c.qa_evidence||null,
  at:new Date().toISOString()};
 const file=await put(root,'diagnostics',c.task_id+c.sha256+String(c.attempts),report);
 await put(root,'fixiki-outbox',c.task_id+c.sha256+String(c.attempts),{
  schema:'gauntlet-fix-request-1',target:'capability:fixiki.triage',task_id:c.task_id,
  sha256:c.sha256,diagnostic:file,issues,budget:c.budget,status:'PENDING_DISPATCH'});
 return file;
}
