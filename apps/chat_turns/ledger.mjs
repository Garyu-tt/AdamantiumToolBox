import {mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
const root=process.env.ADA_APP_DATA_DIR||join(process.env.LOCALAPPDATA||homedir(),'Adamantium Toolbox','data','chat_turns');
const file=join(root,'events.jsonl');
const valid=v=>typeof v==='string'&&/^[\w-]{1,90}$/.test(v);
let chain=Promise.resolve();
const serial=fn=>{const task=chain.then(fn);chain=task.catch(()=>{});return task;};
async function load(){try{return (await readFile(file,'utf8')).split('\n').filter(Boolean).map(JSON.parse);}
 catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function append(e){await mkdir(root,{recursive:true,mode:0o700});const f=await open(file,'a',0o600);
 try{await f.writeFile(JSON.stringify(e)+'\n');await f.sync();}finally{await f.close();}}
function state(xs){
 const threads=new Map(),get=id=>{if(!threads.has(id))threads.set(id,{thread:id,inputs:new Map(),done:new Set(),active:null});return threads.get(id);};
 for(const e of xs){const t=get(e.thread);
  if(e.kind==='input')t.inputs.set(e.sourceId,{sourceId:e.sourceId,sourceSeq:e.sourceSeq});
  if(e.kind==='claim')t.active={id:e.turnId,inputs:e.inputs,interruptRequested:false};
  if(e.kind==='input'&&t.active&&e.interruptTurnId===t.active.id)t.active.interruptRequested=true;
  if(e.kind==='interrupt'&&t.active?.id===e.turnId)t.active.interruptRequested=true;
  if(e.kind==='close'&&t.active?.id===e.turnId){if(e.outcome==='completed')for(const x of t.active.inputs)t.done.add(x.sourceId);t.active=null;}
 }
 for(const t of threads.values())t.pending=[...t.inputs.values()].filter(i=>!t.done.has(i.sourceId))
  .sort((a,b)=>a.sourceSeq-b.sourceSeq||a.sourceId.localeCompare(b.sourceId));
 return threads;
}
function readable(t){return {thread:t.thread,active:t.active,pending:t.pending.length,
 next:t.pending.slice(0,100),completed:t.done.size};}
export async function invoke(action,p={}){
 if(action==='chat_turns.status'){
  if(p.thread!==undefined&&!valid(p.thread))throw Error('invalid_thread');
  const threads=state(await load());return p.thread?readable(threads.get(p.thread)||
   {thread:p.thread,active:null,pending:[],done:new Set()}):{threads:[...threads.values()].map(readable)};
 }
 if(!['chat_turns.register','chat_turns.claim','chat_turns.interrupt','chat_turns.close'].includes(action))throw Error('unknown_action');
 if(!valid(p.opId)||!valid(p.thread))throw Error('invalid_ids');
 const digest=createHash('sha256').update(JSON.stringify({action,params:p})).digest('hex');
 return serial(async()=>{
  const xs=await load(),prior=xs.find(x=>x.opId===p.opId);
  if(prior){if(prior.digest!==digest)throw Error('op_conflict');return {...prior.receipt,replayed:true};}
  const threads=state(xs),t=threads.get(p.thread)||{thread:p.thread,inputs:new Map(),done:new Set(),pending:[],active:null};
  const e={kind:'',thread:p.thread,opId:p.opId,digest,at:new Date().toISOString(),seq:(xs.at(-1)?.seq||0)+1};let receipt={};
  if(action==='chat_turns.register'){
   if(!valid(p.sourceId)||!Number.isSafeInteger(p.sourceSeq)||p.sourceSeq<1)throw Error('invalid_source');
   const old=t.inputs.get(p.sourceId);
   if(old){if(old.sourceSeq!==p.sourceSeq)throw Error('source_conflict');return {sourceId:p.sourceId,registered:true,already:true};}
   if([...t.inputs.values()].some(x=>x.sourceSeq===p.sourceSeq))throw Error('sequence_conflict');
   Object.assign(e,{kind:'input',sourceId:p.sourceId,sourceSeq:p.sourceSeq});
   receipt={sourceId:p.sourceId,registered:true,interruptRequested:!!t.active};
   if(t.active)Object.assign(e,{interruptTurnId:t.active.id});
  }else if(action==='chat_turns.claim'){
   if(t.active)throw Error('turn_active');if(!t.pending.length)throw Error('queue_empty');
   const inputs=t.pending.slice(0,100),turnId=randomUUID();
   Object.assign(e,{kind:'claim',turnId,inputs});receipt={turnId,inputs,state:'running'};
  }else if(action==='chat_turns.interrupt'){
   if(!valid(p.turnId)||t.active?.id!==p.turnId)throw Error('turn_not_active');
   Object.assign(e,{kind:'interrupt',turnId:p.turnId});receipt={turnId:p.turnId,state:'interrupt_requested'};
  }else{
   if(!valid(p.turnId)||t.active?.id!==p.turnId)throw Error('turn_not_active');
   if(!['completed','failed','superseded'].includes(p.outcome))throw Error('invalid_outcome');
   if(t.active.interruptRequested&&p.outcome==='completed')throw Error('stale_completion');
   if(!t.active.interruptRequested&&p.outcome==='superseded')throw Error('no_interrupt_requested');
   Object.assign(e,{kind:'close',turnId:p.turnId,outcome:p.outcome});receipt={turnId:p.turnId,state:p.outcome};
  }
  e.receipt=receipt;await append(e);return {...receipt,replayed:false};
 });
}
