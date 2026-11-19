import {mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
const root=process.env.ADA_APP_DATA_DIR||join(process.env.LOCAPPDATA||process.env.LOCALAPPDATA||homedir(),'Adamantium Toolbox','data','chat_context');
const file=join(root,'events.jsonl'),valid=v=>typeof v==='string'&&/^[\w-]{1,90}$/.test(v);
let chain=Promise.resolve();
const serial=fn=>{const task=chain.then(fn);chain=task.catch(()=>{});return task;};
async function load(){try{return (await readFile(file,'utf8')).split('\n').filter(Boolean).map(JSON.parse);}
 catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function append(e){await mkdir(root,{recursive:true,mode:0o700});const h=await open(file,'a',0o600);
 try{await h.writeFile(JSON.stringify(e)+'\n');await h.sync();}finally{await h.close();}}
const state=(xs,thread)=>xs.filter(x=>x.kind==='checkpoint'&&x.thread===thread);
export async function invoke(action,p={}){
 if(!valid(p.thread))throw Error('invalid_thread');
 if(action==='chat_context.read'){
  const xs=state(await load(),p.thread);return {latest:xs.at(-1)||null,
   history:xs.slice(-20).map(x=>({id:x.id,version:x.version,sourceCount:x.sourceCount,sha256:x.sha256,at:x.at}))};
 }
 if(action==='chat_context.due'){
  if(!Number.isSafeInteger(p.messageCount)||p.messageCount<0)throw Error('invalid_count');
  const latest=state(await load(),p.thread).at(-1),since=p.messageCount-(latest?.sourceCount||0);
  if(since<0)throw Error('stale_count');
  return {due:since>=10,uncheckpointed:since,checkpointAt:(latest?.sourceCount||0)+10,
   latestVersion:latest?.version||0};
 }
 if(action!=='chat_context.save')throw Error('unknown_action');
 if(!valid(p.opId))throw Error('invalid_op_id');
 const digest=createHash('sha256').update(JSON.stringify({action,params:p})).digest('hex');
 return serial(async()=>{
  const xs=await load(),prior=xs.find(x=>x.opId===p.opId);
  if(prior){if(prior.digest!==digest)throw Error('op_conflict');return {...prior.receipt,replayed:true};}
  const prev=state(xs,p.thread).at(-1);
  if(!Number.isSafeInteger(p.sourceCount)||p.sourceCount<1||p.sourceCount<(prev?.sourceCount||0))throw Error('invalid_source_count');
  if(typeof p.summary!=='string'||!p.summary.trim()||p.summary.length>16000)throw Error('invalid_summary');
  if(!Array.isArray(p.sourceRefs)||p.sourceRefs.length>100||!p.sourceRefs.every(valid))throw Error('invalid_source_refs');
  if(typeof p.producer!=='string'||p.producer.length>120||!p.producer.trim())throw Error('invalid_producer');
  const e={kind:'checkpoint',id:randomUUID(),thread:p.thread,opId:p.opId,digest,
   version:(prev?.version||0)+1,sourceCount:p.sourceCount,sourceRefs:p.sourceRefs,
   producer:p.producer,summary:p.summary,at:new Date().toISOString()};
  e.sha256=createHash('sha256').update(JSON.stringify({summary:e.summary,sourceCount:e.sourceCount,
   sourceRefs:e.sourceRefs,producer:e.producer})).digest('hex');
  e.receipt={id:e.id,version:e.version,sha256:e.sha256};
  await append(e);return {...e.receipt,replayed:false};
 });
}
