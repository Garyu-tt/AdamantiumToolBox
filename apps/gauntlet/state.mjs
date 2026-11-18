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
export async function detail(root,id){
 const c=await load(root,id);
 if(!c)return null;
 const info=publicView(c);
 if(!c.diagnostic)return {case:info,diagnostic:null};
 const filename=c.diagnostic;
 if(!/^[a-f0-9]{64}\.json$/.test(filename))throw Error('bad_diagnostic_reference');
 const doc=JSON.parse(await readFile(join(root,'diagnostics',filename),'utf8'));
 if(hash(JSON.stringify(doc))+'.json'!==filename||
  doc.task_id!==c.task_id||doc.sha256!==c.sha256)throw Error('diagnostic_integrity_failure');
 return {case:info,diagnostic:doc};
}
export async function blocker(root,c,issues){
 const report={schema:'gauntlet-diagnostic-1',task_id:c.task_id,
  sha256:c.sha256,attempt:c.attempts,issues,
  affected_components:c.affected_components||[],qa_evidence:c.qa_evidence||null,
  at:new Date().toISOString()};
 const file=await put(root,'diagnostics',c.task_id+c.sha256+String(c.attempts),report);
 await put(root,'fixiki-outbox',c.task_id+c.sha256+String(c.attempts),{
  schema:'gauntlet-fix-request-1',required_capability:'task.blocker.triage',task_id:c.task_id,
  sha256:c.sha256,diagnostic:file,issues,budget:c.budget,status:'PENDING_DISPATCH'});
 return file;
}
