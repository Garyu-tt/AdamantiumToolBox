import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DurableJobs} from '../../core/durable_jobs.mjs';
import {execute,validate} from './engine.mjs';
import {call,eligible} from './client.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const allowed=new Set((process.env.ADA_ORCH_ALLOWED_ACTIONS||'').split(',').map(x=>x.trim()).filter(x=>x&&!x.startsWith(manifest.id+'.')));
const max=Number(process.env.ADA_ORCH_MAX_CONCURRENCY||4);
if(!Number.isInteger(max)||max<1||max>128)throw Error('invalid_concurrency');
const store=new DurableJobs(join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','orchestrator','jobs'));
const jobs=new Map((await store.recover()).map(j=>[j.jobId,j])),controllers=new Map(),queue=[];let running=0;
const save=job=>store.save(job);
function slot(work,signal){return new Promise((resolve,reject)=>{queue.push({work,signal,resolve,reject});pump();});}
function pump(){while(running<max&&queue.length){const q=queue.shift();
 if(q.signal?.aborted){q.reject(Error('cancelled'));continue;}
 running++;Promise.resolve().then(q.work).then(q.resolve,q.reject).finally(()=>{running--;pump();});}}
const actions={'orchestrator.providers':'orchestration.read','orchestrator.jobs':'orchestration.read',
 'orchestrator.status':'orchestration.read','orchestrator.submit':'orchestration.execute','orchestrator.cancel':'orchestration.cancel'};
const permitted=id=>caps.has(actions[id])&&(id!=='orchestrator.submit'||allowed.size>0);
const nodes=[{id:'orchestrator.view',type:'view',title:manifest.name,icon:manifest.icon,requires:['orchestration.read']},
 ...Object.entries(actions).filter(([id])=>permitted(id)).map(([id,cap])=>({id,type:'action',title:id,requires:[cap]}))];
const graph={app:manifest.id,version:1,nodes,edges:nodes.slice(1).map(n=>({from:'orchestrator.view',to:n.id,type:'uses'}))};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const summary=j=>({jobId:j.jobId,status:j.status,steps:j.steps,error:j.error,output:j.status==='completed'?j.output:undefined});
async function invoke(action,p){
 if(!permitted(action))throw Error('capability_denied');
 if(action==='orchestrator.providers')return [...await eligible(allowed)];
 if(action==='orchestrator.jobs')return [...jobs.values()].map(summary);
 if(action==='orchestrator.status'){if(!jobs.has(p.jobId))throw Error('job_not_found');return summary(jobs.get(p.jobId));}
 if(action==='orchestrator.cancel'){
  const ctrl=controllers.get(p.jobId),job=jobs.get(p.jobId);
  if(!ctrl||!job)throw Error('job_not_running');
  ctrl.abort();job.status='cancel_requested';await save(job);
  return {jobId:p.jobId,status:'cancel_requested'};
 }
 if(action==='orchestrator.submit'){
  const available=await eligible(allowed);validate(p,available);
  if(controllers.size>=200)throw Error('workflow_queue_full');
  const jobId=randomUUID(),ctrl=new AbortController();
  const job={jobId,status:'queued',steps:{},flow:p,createdAt:new Date().toISOString()};
  await save(job);jobs.set(jobId,job);controllers.set(jobId,ctrl);
  void execute(p,(id,params,signal)=>slot(()=>call('/api/invoke',{action:id,params},signal),signal),
   {allowed:available,parallelism:max,signal:ctrl.signal,onUpdate:async r=>{
    job.status='running';job.steps=r.state;await save(job);}})
   .then(async r=>{job.status='completed';job.output=r.outputs;await save(job);},
   async e=>{const cancelled=ctrl.signal.aborted;ctrl.abort();job.status=cancelled?'cancelled':'failed';
    job.error=String(e.message).slice(0,180);await save(job);})
   .catch(e=>console.error('orchestrator_persist_failed',e.message))
   .finally(()=>controllers.delete(jobId));
  return {jobId,status:'queued'};
 }
 throw Error('unknown_action');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id,running,queued:queue.length});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>130000)req.destroy();});
  req.on('end',async()=>{try{const body=JSON.parse(raw);send(res,200,{result:await invoke(body.action,body.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,180)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
