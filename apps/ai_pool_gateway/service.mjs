import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {verifyDevice,validateDenseJob} from './protocol.mjs';

const m=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const keysPath=process.env.ADA_AI_POOL_ALLOWED_KEYS_FILE||'';
const statePath=process.env.ADA_AI_POOL_STATE_FILE||'';
const configured=Boolean(keysPath&&statePath);
function stateFromDisk() {
  if(!configured)return {jobs:new Map(),nodes:new Map(),seen:new Map()};
  try {
    const parsed=JSON.parse(readFileSync(statePath,'utf8'));
    if(!parsed||typeof parsed!=='object'||!parsed.jobs||!parsed.nodes||!parsed.seen)
      throw Error('invalid_ai_pool_state');
    return {
      jobs:new Map(Object.entries(parsed.jobs)),
      nodes:new Map(Object.entries(parsed.nodes)),
      seen:new Map(Object.entries(parsed.seen))
    };
  }catch(e){
    if(e.code==='ENOENT')return {jobs:new Map(),nodes:new Map(),seen:new Map()};
    throw e; // refuse to silently forget a corrupt lease journal
  }
}
const state=stateFromDisk();
function persist() {
  if(!configured)throw Error('gateway_not_configured');
  mkdirSync(dirname(statePath),{recursive:true,mode:0o700});
  const tmp=statePath+'.'+randomUUID()+'.tmp';
  writeFileSync(tmp,JSON.stringify({
    jobs:Object.fromEntries(state.jobs),nodes:Object.fromEntries(state.nodes),
    seen:Object.fromEntries(state.seen)
  }),{mode:0o600,flag:'wx'});
  renameSync(tmp,statePath);
}
const send=(res,status,body)=>{
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body));
};
function limitedBody(req,limit=131072) {
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,failed=false;
    req.on('data',c=>{
      if(failed)return;
      size+=c.length;
      if(size>limit){failed=true;reject(Error('request_too_large'));req.destroy();}
      else chunks.push(c);
    });
    req.on('end',()=>{if(!failed)resolve(Buffer.concat(chunks));});
    req.on('error',e=>{if(!failed)reject(e);});
  });
}
const actions={
  'ai_pool_gateway.nodes':'ai_pool.read',
  'ai_pool_gateway.jobs':'ai_pool.read',
  'ai_pool_gateway.enqueue':'ai_pool.write',
  'ai_pool_gateway.cancel':'ai_pool.write'
};
const graph={
  app:m.id,version:1,
  nodes:[{id:'ai_pool_gateway.provider',type:'resource',requires:['ai_pool.read'],
    protocol:'android-ai-pool-v1',actions}],
  edges:[]
};
for(const [action,permission] of Object.entries(actions)){
  graph.nodes.push({id:action,type:'action',title:action,requires:[permission]});
  graph.edges.push({from:'ai_pool_gateway.provider',to:action,type:'provides'});
}
const publicNode=n=>({lastSeenMs:n.lastSeenMs,ready:n.ready,metrics:n.metrics,capabilities:n.capabilities});
const publicJob=j=>({
  id:j.id,status:j.status,leasedTo:j.leasedTo||null,expiresAtMs:j.expiresAtMs||null,
  createdAtMs:j.createdAtMs,finishedAtMs:j.finishedAtMs||null,
  result:j.status==='done'?j.result:null
});
function ownerInvoke(body) {
  if(!configured)throw Error('gateway_not_configured');
  const action=body?.action,permission=actions[action];
  if(!permission||!caps.has(permission))throw Error('capability_denied');
  const p=body.params||{};
  if(action==='ai_pool_gateway.nodes')return Object.fromEntries(
    [...state.nodes].map(([id,n])=>[id,publicNode(n)]));
  if(action==='ai_pool_gateway.jobs')return [...state.jobs.values()].map(publicJob);
  if(action==='ai_pool_gateway.enqueue'){
    validateDenseJob(p.job);
    const job=p.job;
    if(state.jobs.has(job.id))return publicJob(state.jobs.get(job.id));
    if(state.jobs.size>=1000)throw Error('queue_capacity');
    const row={...job,id:job.id,status:'queued',createdAtMs:Date.now(),
      leasedTo:null,expiresAtMs:null};
    state.jobs.set(job.id,row);persist();
    return publicJob(row);
  }
  if(action==='ai_pool_gateway.cancel'){
    const job=state.jobs.get(p.id);
    if(!job)throw Error('job_not_found');
    if(job.status==='done')throw Error('job_already_done');
    job.status='cancelled';persist();return publicJob(job);
  }
  throw Error('unknown_action');
}
function enrolled() {
  if(!configured)throw Error('gateway_not_configured');
  const doc=JSON.parse(readFileSync(keysPath,'utf8'));
  if(!doc||typeof doc!=='object'||!doc.nodes||typeof doc.nodes!=='object')
    throw Error('invalid_enrollment_registry');
  return doc;
}
function onPulse(node,data) {
  if(data.protocol!=='android-ai-pool-v1'||data.nodeId!==node||
     typeof data.ready!=='boolean'||!Array.isArray(data.capabilities)||
     !data.metrics||typeof data.metrics!=='object')throw Error('invalid_pulse');
  const metrics=data.metrics;
  const cpuCap=data.capabilities.some(c=>c?.op==='ml.dense.f32'&&c.backend==='cpu-java');
  const eligible=data.ready===true&&cpuCap&&
    (metrics.charging===true||metrics.batteryPercent>=40)&&
    Number.isInteger(metrics.thermalStatus)&&metrics.thermalStatus<=2 &&
    metrics.availableMemoryBytes>=134217728;
  state.nodes.set(node,{
    lastSeenMs:Date.now(),ready:eligible,capabilities:[{op:'ml.dense.f32',backend:'cpu-java'}],
    metrics:{
      api:metrics.api,cpuThreads:metrics.cpuThreads,abis:metrics.abis,
      availableMemoryBytes:metrics.availableMemoryBytes,
      batteryPercent:metrics.batteryPercent,charging:metrics.charging,
      thermalStatus:metrics.thermalStatus
    }
  });
  if(!eligible){persist();return {job:null,accepted:true};}
  const now=Date.now();
  for(const item of state.jobs.values()){
    if(item.status==='leased'&&item.expiresAtMs<=now){
      item.status='queued';item.leasedTo=null;item.expiresAtMs=null;
    }
  }
  for(const job of state.jobs.values()){
    if(job.status!=='queued'||job.op!=='ml.dense.f32')continue;
    job.status='leased';job.leasedTo=node;job.expiresAtMs=now+45000;
    persist();
    return {accepted:true,job:{
      id:job.id,op:job.op,expiresAtMs:job.expiresAtMs,input:job.input,
      weights:job.weights,bias:job.bias,activation:job.activation||'none'
    }};
  }
  persist();return {accepted:true,job:null};
}
function onResult(node,p) {
  if(p.op!=='ml.dense.f32'||typeof p.jobId!=='string')
    throw Error('invalid_result');
  const job=state.jobs.get(p.jobId);
  if(!job)throw Error('unknown_job');
  if(job.status==='done') {
    if(job.leasedTo!==node)throw Error('result_owner_mismatch');
    if(JSON.stringify(job.result)!==JSON.stringify(p.result))throw Error('conflicting_duplicate_result');
    return {accepted:true,duplicate:true};
  }
  if(job.status!=='leased'||job.leasedTo!==node||job.expiresAtMs<=Date.now())
    throw Error('lease_not_held');
  if(!Array.isArray(p.result)||p.result.length!==job.bias.length||
     !p.result.every(v=>typeof v==='number'&&Number.isFinite(v)))
    throw Error('invalid_tensor_result');
  job.result=p.result;job.status='done';job.finishedAtMs=Date.now();
  persist();
  return {accepted:true,duplicate:false};
}
async function signedRequest(req,res,path) {
  if(!configured)return send(res,503,{error:'gateway_not_configured'});
  try {
    const raw=await limitedBody(req);
    const auth=verifyDevice(req.headers,path,raw,enrolled());
    const now=Date.now();
    for(const [id,at] of state.seen)if(at<now-180000)state.seen.delete(id);
    const replay=auth.node+':'+auth.requestId;
    if(state.seen.has(replay))throw Error('replayed_request');
    state.seen.set(replay,now);
    persist(); // nonce persisted before stateful dispatch
    const body=JSON.parse(raw.toString('utf8'));
    const result=path.endsWith('/pulse')?onPulse(auth.node,body):onResult(auth.node,body);
    return send(res,200,result);
  }catch(e){return send(res,403,{error:String(e.message).slice(0,100)});}
}
http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/health')
    return send(res,200,{app:m.id,configured});
  if(req.method==='POST'&&(req.url==='/api/ai-core/v1/pulse'||
     req.url==='/api/ai-core/v1/results'))
    return signedRequest(req,res,req.url);
  if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
  if(req.method==='GET'&&req.url==='/graph')
    return send(res,200,configured?graph:{app:m.id,version:1,nodes:[],edges:[]});
  if(req.method==='POST'&&req.url==='/invoke'){
    try{
      const data=JSON.parse((await limitedBody(req,32768)).toString('utf8'));
      return send(res,200,{result:ownerInvoke(data)});
    }catch(e){return send(res,400,{error:String(e.message).slice(0,100)});}
  }
  return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||m.service.port),'127.0.0.1');
