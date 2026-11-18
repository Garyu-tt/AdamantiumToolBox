import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {execute,validate} from './engine.mjs';
import {call,eligible} from './client.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const allowed=new Set((process.env.ADA_ORCH_ALLOWED_ACTIONS||'').split(',').map(x=>x.trim()).filter(x=>x&&!x.startsWith(manifest.id+'.')));
const max=Number(process.env.ADA_ORCH_MAX_CONCURRENCY||4);
if(!Number.isInteger(max)||max<1||max>128)throw Error('invalid_concurrency');
const jobs=new Map(),controllers=new Map(),queue=[];let running=0;
function slot(work){return new Promise((resolve,reject)=>{queue.push({work,resolve,reject});pump();});}
function pump(){while(running<max&&queue.length){const q=queue.shift();running++;
 Promise.resolve().then(q.work).then(q.resolve,q.reject).finally(()=>{running--;pump();});}}
const actions={'orchestrator.providers':'orchestration.read','orchestrator.jobs':'orchestration.read',
 'orchestrator.status':'orchestration.read','orchestrator.submit':'orchestration.execute','orchestrator.cancel':'orchestration.cancel'};
const permitted=id=>caps.has(actions[id])&&(id!=='orchestrator.submit'||allowed.size>0);
const nodes=[{id:'orchestrator.view',type:'view',title:manifest.name,icon:manifest.icon,requires:['orchestration.read']},
 ...Object.entries(actions).filter(([id])=>permitted(id)).map(([id,cap])=>({id,type:'action',title:id,requires:[cap]}))];
const graph={app:manifest.id,version:1,nodes,edges:nodes.slice(1).map(n=>({from:'orchestrator.view',to:n.id,type:'uses'}))};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const summary=j=>({jobId:j.jobId,status:j.status,steps:j.steps,error:j.error,output:j.status==='completed'?j.output:undefined});
async function invoke(action,p){
 if(!permitted(action))throw Error('capability_denied');
 if(action==='orchestrator.providers')return [...await eligible(allowed)];
 if(action==='orchestrator.jobs')return [...jobs.values()].map(summary);
 if(action==='orchestrator.status'){if(!jobs.has(p.jobId))throw Error('job_not_found');return summary(jobs.get(p.jobId));}
 if(action==='orchestrator.cancel'){
  if(!controllers.has(p.jobId))throw Error('job_not_running');
  controllers.get(p.jobId).abort();return {jobId:p.jobId,status:'cancel_requested'};
 }
 if(action==='orchestrator.submit'){
  const available=await eligible(allowed);validate(p,available);
  const jobId=randomUUID(),ctrl=new AbortController();controllers.set(jobId,ctrl);
  const record={jobId,status:'queued',steps:{}};jobs.set(jobId,record);
  if(jobs.size>200){for(const [id,j] of jobs){if(!controllers.has(id)){jobs.delete(id);break;}}}
  void execute(p,(id,params,signal)=>slot(()=>call('/api/invoke',{action:id,params},signal)),
   {allowed:available,parallelism:max,signal:ctrl.signal,onUpdate:r=>{record.status='running';record.steps=structuredClone(r.state);}})
   .then(r=>{record.status='completed';record.output=r.outputs;},e=>{record.status=ctrl.signal.aborted?'cancelled':'failed';record.error=String(e.message).slice(0,180);})
   .finally(()=>controllers.delete(jobId));
  return {jobId,status:'queued'};
 }
 throw Error('unknown_action');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>130000)req.destroy();});
  req.on('end',async()=>{try{const body=JSON.parse(raw);send(res,200,{result:await invoke(body.action,body.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,180)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
