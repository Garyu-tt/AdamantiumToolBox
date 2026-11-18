import {setTimeout as sleep} from 'node:timers/promises';
const key=/^[a-z][a-z0-9_-]{0,63}$/;
const action=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z0-9_-]+)+$/;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function validate(flow,allowed,maxSteps=64){
 if(!flow||!Array.isArray(flow.steps)||!flow.steps.length||flow.steps.length>maxSteps)throw Error('invalid_workflow');
 const ids=new Set();
 for(const s of flow.steps){
  if(!s||!key.test(s.id)||ids.has(s.id)||!action.test(s.action)||!allowed.has(s.action))throw Error('step_denied');
  if(s.after!==undefined&&(!Array.isArray(s.after)||s.after.some(x=>typeof x!=='string')))throw Error('invalid_dependencies');
  if(s.poll!==undefined&&(!s.poll||!allowed.has(s.poll.action)||!action.test(s.poll.action)||
   (s.poll.intervalMs!==undefined&&(!Number.isInteger(s.poll.intervalMs)||s.poll.intervalMs<100||s.poll.intervalMs>10000))||
   (s.poll.maxAttempts!==undefined&&(!Number.isInteger(s.poll.maxAttempts)||s.poll.maxAttempts<1||s.poll.maxAttempts>10000))))throw Error('poll_denied');
  ids.add(s.id);
 }
 const graph=new Map(flow.steps.map(s=>[s.id,s.after||[]]));
 const visited=new Set(),visiting=new Set();
 function walk(id){if(visiting.has(id))throw Error('workflow_cycle');if(visited.has(id))return;
  if(!graph.has(id))throw Error('unknown_dependency');visiting.add(id);
  for(const dep of graph.get(id))walk(dep);
  visiting.delete(id);visited.add(id);}
 for(const id of ids)walk(id);
 return flow.steps;
}
export function expand(value,outputs,depth=0){
 if(depth>20)throw Error('expression_depth');
 if(Array.isArray(value))return value.map(x=>expand(x,outputs,depth+1));
 if(!value||typeof value!=='object')return value;
 if(own(value,'$step')){
  if(Object.keys(value).some(k=>!['$step','path'].includes(k))||!own(outputs,value.$step))throw Error('reference_unavailable');
  const path=value.path||[];if(!Array.isArray(path)||path.length>12)throw Error('bad_reference');
  let data=outputs[value.$step];
  for(const k of path){if(!/^[a-zA-Z0-9_-]+$/.test(String(k))||['__proto__','constructor','prototype'].includes(k)||data===null||!own(Object(data),k))throw Error('bad_reference');data=data[k];}
  return data;
 }
 const result=Object.create(null);
 for(const [k,v] of Object.entries(value)){
  if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe_field');
  result[k]=expand(v,outputs,depth+1);
 }
 return result;
}
export async function execute(flow,invoke,{allowed,parallelism=4,signal,onUpdate=()=>{}}={}){
 const steps=validate(flow,allowed),outputs=Object.create(null),state=Object.create(null);
 const pending=new Map(steps.map(s=>[s.id,s]));const running=new Map();
 const limit=Math.min(Math.max(1,parallelism),Math.max(1,Number(flow.parallelism)||parallelism));
 const notify=(id,status,extra={})=>{state[id]={status,...extra};onUpdate({state,outputs});};
 async function task(s){
  notify(s.id,'running');let result=await invoke(s.action,expand(s.params||{},outputs),signal);
  if(s.poll){
   if(!result||result.status!=='queued'||typeof result.jobId!=='string')throw Error('invalid_async_job');
   const delay=s.poll.intervalMs||1000,jobId=result.jobId,maxAttempts=s.poll.maxAttempts||600;
   for(let attempt=0;attempt<maxAttempts;attempt++){
    if(signal?.aborted)throw Error('cancelled');
    try{await sleep(delay,undefined,{signal});}catch{throw Error('cancelled');}
    result=await invoke(s.poll.action,{jobId},signal);
    if(['completed','failed','cancelled'].includes(result?.status))break;
    if(!['queued','running'].includes(result?.status))throw Error('bad_async_status');
   }
   if(result.status!=='completed')throw Error(result.status==='running'||result.status==='queued'?'poll_limit_exceeded':'provider_'+result.status);
  }
  if(signal?.aborted)throw Error('cancelled');outputs[s.id]=result;notify(s.id,'completed');
 }
 while(pending.size||running.size){
  if(signal?.aborted)throw Error('cancelled');
  for(const [id,s] of pending){
   if(running.size>=limit)break;
   if((s.after||[]).every(dep=>state[dep]?.status==='completed')){
    pending.delete(id);const p=task(s).then(()=>({id}),error=>({id,error}));running.set(id,p);
   }
  }
  if(!running.size)throw Error('workflow_stalled');
  const settled=await Promise.race(running.values());running.delete(settled.id);
  if(settled.error){notify(settled.id,'failed',{error:String(settled.error.message).slice(0,160)});throw settled.error;}
 }
 return {status:'completed',steps:state,outputs};
}
