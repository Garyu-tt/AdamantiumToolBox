import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,randomUUID,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import net from 'node:net';
import {canonical,verifyDevice,validateDenseJob} from '../apps/ai_pool_gateway/protocol.mjs';

function fixture() {
  const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const der=publicKey.export({format:'der',type:'spki'});
  return {privateKey,pub:der.toString('base64'),id:createHash('sha256').update(der).digest('hex')};
}
function envelope(f,path,data,requestId=randomUUID()) {
  const body=JSON.stringify(data),timestamp=String(Date.now());
  const signature=sign('sha256',
    canonical(path,timestamp,requestId,Buffer.from(body)),f.privateKey).toString('base64');
  return {body,headers:{
    'content-type':'application/json',
    'x-ai-core-node':f.id,'x-ai-core-key':f.pub,
    'x-ai-core-timestamp':timestamp,'x-ai-core-request':requestId,
    'x-ai-core-signature':signature
  }};
}
async function freePort() {
  return new Promise((ok,bad)=>{
    const s=net.createServer();
    s.once('error',bad);
    s.listen(0,'127.0.0.1',()=>{
      const port=s.address().port;
      s.close(()=>ok(port));
    });
  });
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));

test('P256 signature, deny unregistered keys and bounded neural gene',()=>{
  const f=fixture(),path='/api/ai-core/v1/pulse';
  const msg=envelope(f,path,{ready:false});
  const headers=Object.fromEntries(Object.entries(msg.headers));
  assert.equal(verifyDevice(headers,path,Buffer.from(msg.body),
    {nodes:{[f.id]:{enabled:true,keyBase64:f.pub,allowedOps:['ml.dense.f32']}}}).node,f.id);
  assert.throws(()=>verifyDevice(headers,path,Buffer.from(msg.body),
    {nodes:{}}),/device_not_enrolled/);
  assert.throws(()=>verifyDevice(headers,path,Buffer.from('tampered'),
    {nodes:{[f.id]:{enabled:true,keyBase64:f.pub,allowedOps:['ml.dense.f32']}}}),/bad_device_signature/);
  assert.equal(validateDenseJob({id:'a',op:'ml.dense.f32',input:[1,2],
    weights:[[3,4]],bias:[5],activation:'none'}),true);
  assert.throws(()=>validateDenseJob({id:'a',op:'exec',input:[1],
    weights:[[1]],bias:[0]}),/invalid_dense_job/);
});

test('MAS gateway: enrolled phone leases bounded job and signed result idempotently',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'adamantium-ai-gw-'));
  const f=fixture(),port=await freePort(),secret='test-only-adamantium-internal-key-123';
  const allowedPath=join(dir,'enrollment.json'),statePath=join(dir,'jobs.json');
  await writeFile(allowedPath,JSON.stringify({nodes:{
    [f.id]:{enabled:true,keyBase64:f.pub,allowedOps:['ml.dense.f32']}
  }}));
  const child=spawn(process.execPath,[resolve('apps/ai_pool_gateway/service.mjs')],{
    cwd:resolve('.'),env:{...process.env,
      ADA_INTERNAL_KEY:secret,ADA_CAPS:'ai_pool.read,ai_pool.write',
      ADA_AI_POOL_ALLOWED_KEYS_FILE:allowedPath,ADA_AI_POOL_STATE_FILE:statePath,
      APP_PORT:String(port)
    },stdio:'ignore'
  });
  t.after(async()=>{child.kill();await rm(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+port;
  let alive=false;
  for(let i=0;i<50;i++){
    if(child.exitCode!==null)break;
    try{const r=await fetch(base+'/health');if(r.ok){alive=true;break;}}catch{}
    await pause(80);
  }
  assert.equal(alive,true,'server did not start');
  const internal=async(action,params={})=>{
    const r=await fetch(base+'/invoke',{method:'POST',
      headers:{'content-type':'application/json','x-internal-key':secret},
      body:JSON.stringify({action,params})});
    assert.equal(r.status,200);
    return (await r.json()).result;
  };
  const path='/api/ai-core/v1/pulse';
  const signedPost=async(p,body)=>{
    const e=envelope(f,p,body);
    return fetch(base+p,{method:'POST',headers:e.headers,body:e.body});
  };
  const job={id:'lease-test-1',op:'ml.dense.f32',input:[2,-1],
    weights:[[3,4],[-1,1]],bias:[1,0],activation:'relu'};
  assert.equal((await internal('ai_pool_gateway.enqueue',{job})).status,'queued');
  const pulse={protocol:'android-ai-pool-v1',nodeId:f.id,ready:true,
    capabilities:[{op:'ml.dense.f32',backend:'cpu-java'}],
    metrics:{charging:true,batteryPercent:80,thermalStatus:0,
      availableMemoryBytes:1_000_000_000}};
  const first=envelope(f,path,pulse);
  const res=await fetch(base+path,{method:'POST',headers:first.headers,body:first.body});
  assert.equal(res.status,200);
  const response=await res.json();
  assert.equal(response.job.id,job.id);
  const replay=await fetch(base+path,{method:'POST',headers:first.headers,body:first.body});
  assert.equal(replay.status,403);
  const result={jobId:job.id,op:'ml.dense.f32',result:[3,0],completedAtMs:Date.now()};
  const completed=await signedPost('/api/ai-core/v1/results',result);
  assert.equal(completed.status,200);
  assert.equal((await completed.json()).duplicate,false);
  const duplicate=await signedPost('/api/ai-core/v1/results',result);
  assert.equal(duplicate.status,200);
  assert.equal((await duplicate.json()).duplicate,true);
  const jobs=await internal('ai_pool_gateway.jobs');
  assert.equal(jobs.find(x=>x.id===job.id).status,'done');
  assert.equal((await internal('ai_pool_gateway.nodes'))[f.id].ready,true);
});
