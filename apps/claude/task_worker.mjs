import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {call} from './client.mjs';
const runAction=(api,action,params,signal)=>api('/api/invoke',{action,params},signal);
export function selectPool(graph,wanted){
 const actions=new Set((graph?.nodes||[]).filter(n=>n.type==='action').map(n=>n.id));
 const eligible=(graph?.nodes||[]).filter(n=>n.type==='resource'&&
  n.provider?.schema==='mas-task-provider-1'&&actions.has(n.provider.claimAction)&&
  actions.has(n.provider.heartbeatAction)&&actions.has(n.provider.completeAction));
 const matches=wanted?eligible.filter(n=>n.id===wanted):eligible;
 if(!matches.length)return null;
 if(matches.length!==1)throw Error('multiple_task_providers');
 return matches[0].provider;
}
export async function executeOne({api=call,workerId,skills,pollMs=1000,heartbeatMs=60000,
 leaseMs=300000,maxPolls=600,signal,allowTools=false,providerId=null,
 taskContract='ai.text.generate'}={}){
 if(!Number.isInteger(pollMs)||pollMs<100||pollMs>10000||!Number.isInteger(heartbeatMs)||
  heartbeatMs<100||heartbeatMs>=leaseMs||!Number.isInteger(maxPolls)||maxPolls<1||maxPolls>3600)
  throw Error('invalid_worker_policy');
 const graph=await api('/api/graph',undefined,signal),pool=selectPool(graph,providerId);
 if(!pool)return {status:'no_task_provider'};
 const actions=new Set(graph.nodes.filter(n=>n.type==='action').map(n=>n.id));
 if(!actions.has('claude.start')||!actions.has('claude.status'))throw Error('claude_capabilities_unavailable');
 const claim=await runAction(api,pool.claimAction,{workerId,capabilities:skills,leaseMs,requiresContract:taskContract},signal);
 if(claim.status==='empty')return claim;
 if(claim.status!=='claimed'||!claim.token||!claim.taskId)throw Error('invalid_claim_response');
 const payload=claim.payload||{};
 if(typeof payload.prompt!=='string'||!payload.prompt.trim())throw Error('task_prompt_required');
 const started=await runAction(api,'claude.start',{prompt:payload.prompt,
  system:typeof payload.system==='string'?payload.system:undefined,
  tools:allowTools&&payload.tools===true},signal);
 if(started.status!=='queued'||typeof started.jobId!=='string')throw Error('invalid_claude_job');
 let lastBeat=Date.now();
 for(let attempt=0;attempt<maxPolls;attempt++){
  try{await sleep(pollMs,undefined,{signal});}catch{throw Error('cancelled');}
  if(Date.now()-lastBeat>=heartbeatMs){
   const beat=await runAction(api,pool.heartbeatAction,{taskId:claim.taskId,
    workerId,token:claim.token},signal);
   if(beat.status!=='claimed')throw Error('task_lease_lost');lastBeat=Date.now();
  }
  const result=await runAction(api,'claude.status',{jobId:started.jobId},signal);
  if(['queued','running'].includes(result.status))continue;
  if(result.status==='completed'){
   const value=result.result||{};
   const outcome={content:String(value.content||'').slice(0,6000),model:value.model,usage:value.usage};
   const saved=await runAction(api,pool.completeAction,{taskId:claim.taskId,
    workerId,token:claim.token,result:outcome},signal);
   if(saved.status!=='completed')throw Error('task_completion_uncertain');
   return {status:'completed',taskId:claim.taskId,jobId:started.jobId};
  }
  if(result.status==='failed'||result.status==='cancelled'){
   if(!pool.failAction||!actions.has(pool.failAction))throw Error('claude_job_failed_unresolved');
   const saved=await runAction(api,pool.failAction,{taskId:claim.taskId,workerId,
    token:claim.token,error:result.error||result.status},signal);
   return {status:saved.status,taskId:claim.taskId};
  }
  throw Error('unexpected_claude_state');
 }
 throw Error('worker_poll_limit');
}
export async function startWorkers({count=0,api=call,signal}={}){
 if(!Number.isInteger(count)||count<0||count>32)throw Error('invalid_worker_count');
 const skills=(process.env.ADA_CLAUDE_TASK_CAPABILITIES||'ai.text.generate').split(',').map(s=>s.trim()).filter(Boolean);
 const pollMs=Number(process.env.ADA_CLAUDE_TASK_POLL_MS||1000);
 const tasks=Array.from({length:count},(_,i)=>(async()=>{
  const workerId='claude-'+i+'-'+randomUUID();
  while(!signal?.aborted){
   try{await executeOne({api,workerId,skills,pollMs,signal,
    allowTools:process.env.ADA_CLAUDE_TASK_ALLOW_TOOLS==='true',
    providerId:process.env.ADA_CLAUDE_TASK_PROVIDER||null,
    taskContract:process.env.ADA_CLAUDE_TASK_CONTRACT||'ai.text.generate'});}
   catch(e){if(signal?.aborted)break;console.error('claude_worker_error',e.message);}
   try{await sleep(2000,undefined,{signal});}catch{break;}
  }
 })());
 return Promise.allSettled(tasks);
}
