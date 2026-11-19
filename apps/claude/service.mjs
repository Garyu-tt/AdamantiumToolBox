import http from 'node:http';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {DurableJobs} from '../../core/durable_jobs.mjs';
import {configured} from './provider.mjs';
import {runAgent} from './agent.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const store=new DurableJobs(join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','claude','jobs'));
const jobs=new Map((await store.recover()).map(j=>[j.jobId,j])),controllers=new Map(),waiting=[];
const max=Number(process.env.ADA_CLAUDE_WORKERS||4);
if(!Number.isInteger(max)||max<1||max>128)throw Error('invalid_worker_limit');
let active=0;
const persist=job=>{const {controller,...record}=job;return store.save(record);};
const summary=j=>({jobId:j.jobId,status:j.status,error:j.error,result:j.result,createdAt:j.createdAt});
function pump(){while(active<max&&waiting.length){
 const job=waiting.shift();if(job.status!=='queued'){controllers.delete(job.jobId);continue;}active++;
 void (async()=>{try{
  job.status='running';await persist(job);
  if(job.controller.signal.aborted)throw Error('cancelled');
  const result=await runAgent(job.request,job.controller.signal);
  if(job.controller.signal.aborted)throw Error('cancelled');
  job.result=result;job.status='completed';
 }catch(e){job.status=job.controller.signal.aborted?'cancelled':'failed';
  job.error=String(e.message).slice(0,160);}
 finally{await persist(job).catch(e=>console.error('claude_persist_failed',e.message));
  controllers.delete(job.jobId);active--;pump();}
 })();
}}
const actions={'claude.status':'claude.read','claude.jobs':'claude.read',
 'claude.start':'claude.run','claude.cancel':'claude.cancel'};
const enabled=id=>caps.has(actions[id])&&(id!=='claude.start'||configured());
const nodes=[{id:'claude.view',type:'view',title:manifest.name,icon:manifest.icon,requires:['claude.read']},
 ...Object.entries(actions).filter(([id])=>enabled(id)).map(([id,cap])=>({id,type:'action',title:id,requires:[cap]}))];
if(configured()&&caps.has('claude.run')&&caps.has('claude.read'))nodes.push({id:'claude.provider',
 type:'resource',requires:['claude.run'],provider:{schema:'mas-agent-provider-1',
 startAction:'claude.start',statusAction:'claude.status',cancelAction:caps.has('claude.cancel')?'claude.cancel':null,agentTools:'optional-allowlisted'}});
const graph={app:manifest.id,version:1,nodes,edges:nodes.slice(1).map(n=>({from:'claude.view',to:n.id,type:'uses'}))};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function invoke(id,p){
 if(!enabled(id))throw Error('capability_denied');
 if(id==='claude.jobs')return [...jobs.values()].map(summary);
 if(id==='claude.status'){if(!jobs.has(p.jobId))throw Error('job_not_found');return summary(jobs.get(p.jobId));}
 if(id==='claude.cancel'){
  const controller=controllers.get(p.jobId),job=jobs.get(p.jobId);
  if(!controller||!job)throw Error('job_not_running');
  const queued=job.status==='queued';controller.abort();job.status=queued?'cancelled':'cancel_requested';
  if(queued){const at=waiting.indexOf(job);if(at>=0)waiting.splice(at,1);controllers.delete(job.jobId);}
  await persist(job);return {jobId:p.jobId,status:job.status};
 }
 if(id==='claude.start'){
  if(typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>100000)throw Error('invalid_prompt');
  if(p.system!==undefined&&(typeof p.system!=='string'||p.system.length>20000))throw Error('invalid_system');
  if(waiting.length>=200)throw Error('worker_queue_full');
  const jobId=randomUUID(),job={jobId,status:'queued',request:p,createdAt:new Date().toISOString()};
  await persist(job);job.controller=new AbortController();jobs.set(jobId,job);
  controllers.set(jobId,job.controller);waiting.push(job);pump();return {jobId,status:'queued'};
 }
 throw Error('action_not_found');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id,configured:configured(),workers:active});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>130000)req.destroy();});
  req.on('end',async()=>{try{const body=JSON.parse(raw);send(res,200,{result:await invoke(body.action,body.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,180)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
