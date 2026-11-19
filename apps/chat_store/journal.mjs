import {mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
const home=process.env.ADA_APP_DATA_DIR||join(process.env.LOCALAPPDATA||homedir(),'Adamantium Toolbox','data','chat_store');
const file=join(home,'events.jsonl');
let pending=Promise.resolve();
const serialize=fn=>{const next=pending.then(fn);pending=next.catch(()=>{});return next;};
async function events(){
 try{return (await readFile(file,'utf8')).split('\n').filter(Boolean).map(s=>JSON.parse(s));}
 catch(e){if(e.code==='ENOENT')return [];throw e;}
}
const validText=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const validId=v=>typeof v==='string'&&/^[\w-]{1,90}$/.test(v);
const validOp=v=>validId(v);
async function record(e){
 await mkdir(home,{recursive:true,mode:0o700});
 const fd=await open(file,'a',0o600);
 try{await fd.writeFile(JSON.stringify(e)+'\n');await fd.sync();}
 finally{await fd.close();}
}
function project(xs){
 const threads=new Map(),messages=[];
 for(const e of xs){
  if(e.kind==='thread.created')threads.set(e.thread,{id:e.thread,title:e.title,updated:e.at,count:0});
  if(e.kind==='message.appended'&&threads.has(e.thread)){
   const t=threads.get(e.thread);t.count++;t.updated=e.at;
   messages.push({id:e.id,thread:e.thread,seq:e.seq,role:e.role,text:e.text,at:e.at});
  }
 }
 return {threads:[...threads.values()].sort((a,b)=>b.updated.localeCompare(a.updated)),messages};
}
export async function invoke(action,p={}){
 if(action==='chat_store.list')return {threads:project(await events()).threads};
 if(action==='chat_store.read'){
  if(!validId(p.thread))throw Error('invalid_thread');
  const state=project(await events()),thread=state.threads.find(t=>t.id===p.thread);
  if(!thread)throw Error('thread_not_found');
  const after=Number.isSafeInteger(p.after)&&p.after>=0?p.after:0;
  return {thread,messages:state.messages.filter(m=>m.thread===p.thread&&m.seq>after).slice(0,200)};
 }
 if(!['chat_store.create','chat_store.append'].includes(action))throw Error('unknown_action');
 if(!validOp(p.opId))throw Error('invalid_op_id');
 const digest=createHash('sha256').update(JSON.stringify({action,params:p})).digest('hex');
 return serialize(async()=>{
  const xs=await events(),prior=xs.find(x=>x.opId===p.opId);
  if(prior){if(prior.digest!==digest)throw Error('op_conflict');return {id:prior.id,thread:prior.thread,seq:prior.seq,replayed:true};}
  const state=project(xs),seq=(xs.at(-1)?.seq||0)+1,at=new Date().toISOString();
  const e={seq,id:randomUUID(),opId:p.opId,digest,action,at};
  if(action==='chat_store.create'){
   if(p.title!==undefined&&!validText(p.title,160))throw Error('invalid_title');
   Object.assign(e,{kind:'thread.created',thread:randomUUID(),title:p.title||'Новый чат'});
  }else{
   if(!validId(p.thread)||!state.threads.some(t=>t.id===p.thread))throw Error('thread_not_found');
   if(!validText(p.text,20000)||!['user','assistant','system','tool'].includes(p.role))throw Error('invalid_message');
   Object.assign(e,{kind:'message.appended',thread:p.thread,role:p.role,text:p.text});
  }
  await record(e);return {id:e.id,thread:e.thread,seq:e.seq,replayed:false};
 });
}
