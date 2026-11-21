import {open,lstat} from 'node:fs/promises';

const MAX_TAIL=2*1024*1024;
const MAX_TEXT=4096;
const SCHEMA='factory-diagnostic-event/1';
const eventTypes=new Set(['session_start','assistant_message','tool_call','tool_result','github_action','error','usage','session_end','heartbeat']);
const safeId=x=>typeof x==='string'&&x.length>0&&x.length<=160&&/^[\w.:/@-]+$/.test(x);
const secrets=[
 /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
 /\b(Bearer\s+)[A-Za-z0-9._~+/-]{12,}/gi,
 /\b((?:api[_-]?key|access[_-]?token|authorization|password|secret)\s*[:=]\s*)[\"']?[^\s\"',;]+/gi
];
export function redact(value){
 let s=String(value??'');
 for(const pattern of secrets)s=s.replace(pattern,(m,p)=>p?p+'[REDACTED]':'[REDACTED]');
 return s.length>MAX_TEXT?s.slice(0,MAX_TEXT)+' [TRUNCATED]':s;
}
const clean=x=>typeof x==='string'?redact(x):null;
const count=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const usd=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
export function normalize(event){
 if(!event||event.schema!==SCHEMA||!safeId(event.agent_id)||!safeId(event.session_id)||!eventTypes.has(event.type))return null;
 const timestamp=typeof event.at==='string'&&Number.isFinite(Date.parse(event.at))?event.at:null;
 if(!timestamp)return null;
 return {
  schema:SCHEMA,at:timestamp,agent_id:event.agent_id,session_id:event.session_id,
  type:event.type,role:['user','system','assistant','tool'].includes(event.role)?event.role:null,
  provider:clean(event.provider),model:clean(event.model),text:clean(event.text),
  status:clean(event.status),github_url:typeof event.github_url==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull|commit)\/[\w.-]+$/.test(event.github_url)?event.github_url:null,
  commit_sha:typeof event.commit_sha==='string'&&/^[0-9a-f]{7,40}$/i.test(event.commit_sha)?event.commit_sha:null,
  usage:{input_tokens:count(event.usage?.input_tokens),output_tokens:count(event.usage?.output_tokens),cost_usd:usd(event.usage?.cost_usd)}
 };
}
export async function readDiagnostics(path,{agent_id,session_id,limit=100}={}){
 const limitSafe=Number.isInteger(limit)?Math.max(1,Math.min(100,limit)):100;
 if(!path)return {source:'unconfigured',events:[],invalid_records:0,partial:false};
 let file;
 try{
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink())return {source:'invalid_source',events:[],invalid_records:0,partial:false};
  file=await open(path,'r');
  const size=(await file.stat()).size;
  const start=Math.max(0,size-MAX_TAIL);
  const buf=Buffer.alloc(size-start);
  const {bytesRead}=await file.read(buf,0,buf.length,start);
  let lines=buf.toString('utf8',0,bytesRead).split('\n');
  if(start>0)lines=lines.slice(1);
  if(!buf.subarray(0,bytesRead).toString('utf8').endsWith('\n'))lines.pop();
  const events=[];let invalid=0;
  for(const line of lines){
   if(!line)continue;
   try{const event=normalize(JSON.parse(line));if(!event){invalid++;continue;}
    if(agent_id&&event.agent_id!==agent_id||session_id&&event.session_id!==session_id)continue;
    events.push(event);
   }catch{invalid++;}
  }
  return {source:'connected',events:events.slice(-limitSafe).reverse(),sessions:summarize(events.slice().reverse()),invalid_records:invalid,partial:start>0};
 }catch(e){return {source:e.code==='ENOENT'?'missing':'unavailable',events:[],invalid_records:0,partial:false};}
 finally{await file?.close().catch(()=>{});}
}
export function summarize(events){
 const bySession=new Map();
 for(const e of events){
  let row=bySession.get(e.session_id);
  if(!row){row={session_id:e.session_id,agent_id:e.agent_id,provider:e.provider,model:e.model,last_event_at:e.at,last_reply_at:null,last_type:e.type,events:0,cost_usd:null};bySession.set(e.session_id,row);}
  row.events++;
  if(e.type==='assistant_message'&&!row.last_reply_at)row.last_reply_at=e.at;
  if(row.cost_usd===null&&e.usage.cost_usd!==null)row.cost_usd=e.usage.cost_usd;
 }
 return [...bySession.values()];
}
