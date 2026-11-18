import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {generate,configured} from './provider.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const jobs=new Map(),controllers=new Map(),waiting=[];
const max=Number(process.env.ADA_CLAUDE_WORKERS||4);
if(!Number.isInteger(max)||max<1||max>128)throw Error('invalid_worker_limit');
let active=0;
function pump(){while(active<max&&waiting.length){const job=waiting.shift();if(job.status==='cancelled')continue;
 active++;job.status='running';generate(job.request,job.controller.signal).then(x=>{if(!job.controller.signal.aborted){job.result=x;job.status='completed';}},
 e=>{job.status=job.controller.signal.aborted?'cancelled':'failed';job.error=String(e.message).slice(0,160);})
 .finally(()=>{active--;controllers.delete(job.jobId);pump();});}}
const actions={'claude.status':'ai.claude.read','claude.jobs':'ai.claude.read',
 'claude.start':'ai.claude.run','claude.cancel':'ai.claude.cancel'};
const enabled=id=>caps.has(actions[id])&&(id!=='claude.start'||configured());
const nodes=[{id:'claude.view',type:'view',title:manifest.name,icon:manifest.icon,requires:['ai.claude.read']},
 ...Object.entries(actions).filter(([id])=>enabled(id)).map(([id,cap])=>({id,type:'action',title:id,requires:[cap]}))];
if(configured()&&caps.has('ai.claude.run')&&caps.has('ai.claude.read'))nodes.push({id:'claude.provider',type:'resource',requires:['ai.claude.run'],
 provider:{schema:'mas-agent-provider-1',startAction:'claude.start',statusAction:'claude.status',cancelAction:caps.has('ai.claude.cancel')?'claude.cancel':null}});
const graph={app:manifest.id,version:1,nodes,edges:nodes.slice(1).map(n=>({from:'claude.view',to:n.id,type:'uses'}))};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const summary=j=>({jobId:j.jobId,status:j.status,error:j.error,result:j.result});
function invoke(id,p){
 if(!enabled(id))throw Error('capability_denied');
 if(id==='claude.jobs')return [...jobs.values()].map(summary);
 if(id==='claude.status'){if(!jobs.has(p.jobId))throw Error('job_not_found');return summary(jobs.get(p.jobId));}
 if(id==='claude.cancel'){
  if(!controllers.has(p.jobId))throw Error('job_not_running');
  const job=jobs.get(p.jobId);job.status='cancelled';controllers.get(p.jobId).abort();
  return {jobId:p.jobId,status:'cancel_requested'};
 }
 if(id==='claude.start'){
  if(typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>100000)throw Error('invalid_prompt');
  if(p.system!==undefined&&(typeof p.system!=='string'||p.system.length>20000))throw Error('invalid_system');
  if(waiting.length>=200)throw Error('worker_queue_full');
  const jobId=randomUUID(),controller=new AbortController(),job={jobId,status:'queued',request:p,controller};
  jobs.set(jobId,job);controllers.set(jobId,controller);
  if(jobs.size>200){for(const [key,value] of jobs)if(!controllers.has(key)){jobs.delete(key);break;}}
  waiting.push(job);pump();return {jobId,status:'queued'};
 }
 throw Error('action_not_found');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id,configured:configured(),workers:active});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>130000)req.destroy();});
  req.on('end',()=>{try{const body=JSON.parse(raw);send(res,200,{result:invoke(body.action,body.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,180)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
