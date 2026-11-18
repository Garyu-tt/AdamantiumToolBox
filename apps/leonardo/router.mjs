import {remember,findJob,markJob} from './jobs.mjs';
const schema='mas-graphics-provider-1';
const kinds=new Set(['icon','image','video','render']);
function coreEndpoint(){
 const base=process.env.ADA_CORE_URL,token=process.env.ADA_TOKEN;
 if(!base||!token||token.length<24)throw Error('core_connection_unavailable');
 const u=new URL(base);
 if(u.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(u.hostname)||!u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)
  throw Error('core_endpoint_must_be_loopback');
 return u.origin;
}
async function call(path,payload){
 const token=process.env.ADA_TOKEN;
 const response=await fetch(coreEndpoint()+path,{method:payload?'POST':'GET',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('core_http_'+response.status);
 const body=await response.json();if(body.error)throw Error(body.error);
 return payload?body.result:body;
}
export async function discover(){
 const graph=await call('/api/graph'),actions=new Set(graph.nodes.filter(n=>n.type==='action').map(n=>n.id));
 const discovered=[];
 for(const n of graph.nodes){
  if(n.type!=='resource'||n.provider?.schema!==schema||!Array.isArray(n.provider.operations))continue;
  for(const op of n.provider.operations){
   if(!kinds.has(op.kind)||typeof op.action!=='string'||!actions.has(op.action)||
      !op.action.startsWith(n.id.split('.')[0]+'.')||!Array.isArray(op.formats))continue;
   const jobs=op.jobs;
   const jobAction=name=>typeof name==='string'&&name.startsWith(n.id.split('.')[0]+'.')&&actions.has(name)?name:null;
   discovered.push({id:n.id,kind:op.kind,action:op.action,formats:op.formats,
    jobs:jobs?{statusAction:jobAction(jobs.statusAction),cancelAction:jobAction(jobs.cancelAction)}:null,
    locality:n.provider.locality==='remote'?'remote':'local',priority:Number(op.priority)||0});
  }
 }
 return discovered;
}
export async function dispatch(p){
 if(!p||!kinds.has(p.kind)||typeof p.prompt!=='string'||p.prompt.length>4000)throw Error('invalid_graphics_request');
 if(p.providerId!==undefined&&typeof p.providerId!=='string')throw Error('invalid_provider');
 if(p.format!==undefined&&typeof p.format!=='string')throw Error('invalid_format');
 const matches=(await discover()).filter(x=>x.kind===p.kind&&(!p.format||x.formats.includes(p.format))&&
  (!p.providerId||x.id===p.providerId)&& (x.locality==='local'||p.allowRemote===true));
 matches.sort((a,b)=>(a.locality==='local'?0:1)-(b.locality==='local'?0:1)||b.priority-a.priority);
 if(!matches.length)throw Error('no_eligible_graphics_provider');
 const chosen=matches[0];
 const result=await call('/api/invoke',{action:chosen.action,params:{kind:p.kind,prompt:p.prompt,
  format:p.format||chosen.formats[0],options:p.options||{}}});
 if(!result||!['completed','queued'].includes(result.status))throw Error('bad_provider_result');
 if(result.status==='queued'){
  if(p.kind==='icon')throw Error('icon_async_not_supported');
  if(!chosen.jobs?.statusAction)throw Error('provider_missing_job_status');
  const pending=await remember({providerId:chosen.id,kind:p.kind,sourceJobId:result.jobId});
  return {status:'queued',jobId:pending.id,providerId:chosen.id,kind:p.kind};
 }
 return {providerId:chosen.id,action:chosen.action,...result};
}
export async function jobStatus(id){
 const job=await findJob(id);
 const provider=(await discover()).find(p=>p.id===job.providerId&&p.kind===job.kind&&p.jobs?.statusAction);
 if(!provider)return {jobId:id,status:'provider_unavailable',lastKnown:job.status};
 const result=await call('/api/invoke',{action:provider.jobs.statusAction,
  params:{jobId:job.sourceJobId}});
 if(!result||!['queued','running','completed','failed','cancelled'].includes(result.status))
  throw Error('bad_provider_job_status');
 await markJob(id,result.status);
 return {...result,jobId:id,providerId:job.providerId,kind:job.kind};
}
export async function cancelJob(id){
 const job=await findJob(id);
 const provider=(await discover()).find(p=>p.id===job.providerId&&p.kind===job.kind&&p.jobs?.cancelAction);
 if(!provider)return {jobId:id,status:'provider_unavailable',lastKnown:job.status};
 const result=await call('/api/invoke',{action:provider.jobs.cancelAction,
  params:{jobId:job.sourceJobId}});
 if(!['cancelled','cancel_requested'].includes(result?.status))throw Error('bad_provider_cancel');
 await markJob(id,result.status);
 return {jobId:id,status:result.status};
}
