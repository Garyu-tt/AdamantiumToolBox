import {inspect} from './inspect.mjs';
import {stagePackage} from './package.mjs';
import {attest as validateAttestation} from './attestation.mjs';
import {limits,publicView,validTask} from './shared.mjs';
import {load,store,put,blocker} from './state.mjs';
const stamp=(c,status)=>{c.status=status;c.history.push({status,at:new Date().toISOString()});};
const locks=new Map();
async function serialized(id,fn){
 const previous=locks.get(id)||Promise.resolve();let release;
 const next=new Promise(resolve=>release=resolve);locks.set(id,next);
 await previous;try{return await fn();}finally{release();if(locks.get(id)===next)locks.delete(id);}
}
export async function submit(root,input,active=[]){
 if(!validTask(input?.task_id))throw Error('invalid_task_id');
 return serialized(input.task_id,async()=>{
  const old=await load(root,input.task_id),budget=limits();
  if(old?.sha256===input.sha256)return publicView(old);
  if(old&&(old.attempts>=budget.attempts||old.spent_usd>=budget.cost))
   throw Error('retry_budget_exhausted');
  const c={task_id:input.task_id,plugin_id:input.plugin_id,sha256:input.sha256,author_id:input.author_id,
   files:input.files,attempts:(old?.attempts||0)+1,spent_usd:old?.spent_usd||0,
   issues:[],history:old?.history||[],budget,diagnostic:null};
  if(old)stamp(c,'FIXING');stamp(c,'QUEUED');
  const result=inspect(input,active);
  c.issues=result.issues;
  c.affected_components=[input.plugin_id,...c.issues.flatMap(s=>{
   const a=s.split(':');return a.length>1?[a.slice(1).join(':')]:[];
  })].filter(Boolean);
  if(c.issues.length){
   stamp(c,c.attempts>=budget.attempts?'FAILED':'BLOCKED');
   c.diagnostic=await blocker(root,c,c.issues);
  }else{stamp(c,'BUILDING');}
  await store(root,c);return publicView(c);
 });
}
export async function accept(root,input,key){
 if(!validTask(input?.task_id))throw Error('invalid_task_id');
 return serialized(input.task_id,async()=>{
  const c=await load(root,input.task_id);
  if(!c||!['BUILDING','TESTING'].includes(c.status))throw Error('not_awaiting_tests');
  const checked=validateAttestation(input,c,key);
  c.qa_evidence=await put(root,'qa-evidence',c.task_id+c.sha256+input.report.run_id,
   {report:input.report,signature:input.signature});
  c.spent_usd+=checked.cost;stamp(c,'TESTING');c.issues=checked.issues;
  c.affected_components=[c.plugin_id,...checked.issues
   .filter(s=>s.startsWith('dependent_unverified:')).map(s=>s.split(':')[1])].filter(Boolean);
  if(c.spent_usd>c.budget.cost)c.issues.push('cost_budget_exhausted');
  if(c.issues.length){
   stamp(c,c.attempts>=c.budget.attempts||c.spent_usd>=c.budget.cost?'FAILED':'BLOCKED');
   c.diagnostic=await blocker(root,c,c.issues);
  }else{
   let stage;
   try{stage=stagePackage(c);}
   catch(e){
    c.issues=['package_staging_failed:'+String(e.message).slice(0,60)];
    stamp(c,'BLOCKED');c.diagnostic=await blocker(root,c,c.issues);
    await store(root,c);return publicView(c);
   }
   stamp(c,'VERIFIED');
   const releasePayload=await put(root,'release-payloads',c.task_id+c.sha256,stage.payload);
   const rc={schema:'gauntlet-rc-1',task_id:c.task_id,sha256:c.sha256,
    files:c.files,attestation:input.report,signature:input.signature,
    release_payload:releasePayload,mesh_payload_sha256:stage.mesh_payload_sha256};
   const artifact=await put(root,'candidates',c.task_id+c.sha256,rc);
   c.candidate=artifact;c.release_payload=releasePayload;
   stamp(c,'RELEASE_READY');
   c.delivery=await put(root,'delivery-outbox',c.task_id+c.sha256,{
    schema:'gauntlet-delivery-request-1',task_id:c.task_id,sha256:c.sha256,
    artifact,release_payload:releasePayload,mesh_payload_sha256:stage.mesh_payload_sha256,
    approval:'REQUIRED',status:'PENDING_DELIVERY'});
  }
  await store(root,c);return publicView(c);
 });
}
