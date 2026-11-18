import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const schema='mas-task-pool-state-1';
const id=/^[0-9a-f-]{36}$/i,worker=/^[a-z0-9][a-z0-9_.-]{0,63}$/i;
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const requireId=value=>{if(typeof value!=='string'||!id.test(value))throw Error('invalid_task_id');return value;};
const actor=value=>{if(typeof value!=='string'||!worker.test(value))throw Error('invalid_worker_id');return value;};
const validCaps=value=>Array.isArray(value)&&value.length<=32&&value.every(x=>typeof x==='string'&&
 /^[a-z][a-z0-9_.-]{1,79}$/.test(x))&&new Set(value).size===value.length;
const serialized=value=>JSON.stringify(value);
const hash=value=>createHash('sha256').update(serialized(value)).digest('hex');
export class TaskPool{
 constructor(root,clock=()=>Date.now()){this.file=join(root,'task-pool.json');this.root=root;
  this.clock=clock;this.pending=Promise.resolve();}
 async read(){
  try{const doc=JSON.parse(await readFile(this.file,'utf8'));
   if(doc?.schema!==schema||!doc.tasks||typeof doc.tasks!=='object'||Array.isArray(doc.tasks))
    throw Error('invalid_task_store');return doc;
  }catch(e){if(e.code==='ENOENT')return {schema,tasks:{}};throw e;}
 }
 async write(doc){
  await mkdir(this.root,{recursive:true,mode:0o700});
  const path=this.file+'.'+randomUUID()+'.tmp';
  try{await writeFile(path,serialized(doc),{encoding:'utf8',mode:0o600});await rename(path,this.file);}
  finally{await rm(path,{force:true});}
 }
 transact(fn){
  const job=this.pending.then(async()=>{const doc=await this.read(),result=fn(doc);await this.write(doc);return result;});
  this.pending=job.catch(()=>{});return job;
 }
 async startup(){return this.transact(doc=>{
  let uncertain=0;for(const task of Object.values(doc.tasks))if(task.status==='claimed'){
   task.status='needs_review';task.lease=null;task.revision++;task.note='execution_unknown_after_restart';uncertain++;
  }return {uncertain};
 });}
 async list({status,limit=100}={}){if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('invalid_limit');
  const doc=await this.read();return Object.values(doc.tasks).filter(t=>!status||t.status===status)
   .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,limit).map(x=>({...x,lease:x.lease?{expiresAt:x.lease.expiresAt,workerId:x.lease.workerId}:null}));
 }
 async get(taskId){const task=(await this.read()).tasks[requireId(taskId)];
  if(!task)throw Error('task_not_found');return {...task,lease:task.lease?{expiresAt:task.lease.expiresAt,workerId:task.lease.workerId}:null};
 }
 async submit(input){
  if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>160||
   !validCaps(input.requires||[])||input.idempotencyKey!==undefined&&
   (typeof input.idempotencyKey!=='string'||input.idempotencyKey.length>128||!input.idempotencyKey))
   throw Error('invalid_task');
  const payload=input.payload??{},encoded=serialized(payload);
  if(!encoded||Buffer.byteLength(encoded)>8192)throw Error('payload_too_large');
  const requested={title:input.title,requires:input.requires||[],payload};
  return this.transact(doc=>{
   const existing=Object.values(doc.tasks).find(t=>input.idempotencyKey&&t.idempotencyKey===input.idempotencyKey);
   if(existing){if(existing.fingerprint!==hash(requested))throw Error('idempotency_conflict');
    return {taskId:existing.taskId,status:existing.status,duplicate:true};}
   if(Object.keys(doc.tasks).length>=256)throw Error('task_pool_full');
   const taskId=randomUUID(),task={taskId,...requested,status:'queued',revision:1,
    createdAt:new Date(this.clock()).toISOString(),idempotencyKey:input.idempotencyKey||null,
    fingerprint:hash(requested),lease:null};
   doc.tasks[taskId]=task;return {taskId,status:'queued',revision:1};
  });
 }
 async claim({workerId,capabilities=[],leaseMs=300000}={}){
  actor(workerId);if(!validCaps(capabilities)||!Number.isInteger(leaseMs)||leaseMs<10000||leaseMs>600000)
   throw Error('invalid_claim');
  return this.transact(doc=>{
   const eligible=Object.values(doc.tasks).find(t=>t.status==='queued'&&
    t.requires.every(x=>capabilities.includes(x)));
   if(!eligible)return {status:'empty'};
   const token=randomUUID();eligible.status='claimed';eligible.revision++;
   eligible.lease={workerId,token,expiresAt:this.clock()+leaseMs};
   return {status:'claimed',taskId:eligible.taskId,title:eligible.title,
    payload:eligible.payload,requires:eligible.requires,token,expiresAt:eligible.lease.expiresAt};
  });
 }
 async transition(input,target){
  const taskId=requireId(input.taskId);actor(input.workerId);
  if(typeof input.token!=='string'||!id.test(input.token))throw Error('invalid_lease');
  return this.transact(doc=>{
   const t=doc.tasks[taskId];if(!t)throw Error('task_not_found');
   if(t.status!=='claimed'||t.lease?.token!==input.token||t.lease.workerId!==input.workerId)
    throw Error('lease_conflict');
   if(t.lease.expiresAt<=this.clock()){
    t.status='needs_review';t.lease=null;t.revision++;t.note='lease_expired_execution_unknown';
    return {status:'needs_review',taskId};
   }
   if(target==='claimed'){t.lease.expiresAt=this.clock()+300000;t.revision++;
    return {status:'claimed',taskId,expiresAt:t.lease.expiresAt};}
   const data=target==='completed'?input.result:input.error;
   if(Buffer.byteLength(serialized(data)||'')>8192)throw Error('result_too_large');
   t.status=target;t.revision++;t.lease=null;t.outcome=data;t.finishedAt=new Date(this.clock()).toISOString();
   return {status:target,taskId,revision:t.revision};
  });
 }
 async reconcile({taskId,decision,reason,confirm}={}){
  requireId(taskId);if(!['requeue','cancel'].includes(decision)||confirm!==true||
   typeof reason!=='string'||reason.length<8||reason.length>500)throw Error('invalid_review');
  return this.transact(doc=>{
   const t=doc.tasks[taskId];if(!t||t.status!=='needs_review')throw Error('review_required');
   t.status=decision==='requeue'?'queued':'cancelled';t.lease=null;t.revision++;
   t.note=reason;return {taskId,status:t.status,revision:t.revision};
  });
 }
}
