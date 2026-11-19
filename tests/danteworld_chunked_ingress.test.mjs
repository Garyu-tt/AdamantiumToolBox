import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {request} from 'node:http';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const service=fileURLToPath(new URL('../apps/danteworld/service.mjs',import.meta.url));
const key='dante-world-chunked-qa-key-123456789';
const send=(port,chunks)=>new Promise((resolve,reject)=>{
 const req=request({hostname:'127.0.0.1',port,path:'/invoke',method:'POST',
  headers:{'X-Internal-Key':key,'Content-Type':'application/json',
   'Transfer-Encoding':'chunked'}},res=>{
  const parts=[];res.on('data',part=>parts.push(part));
  res.on('end',()=>{try{resolve({status:res.statusCode,
   body:JSON.parse(Buffer.concat(parts).toString('utf8'))});}catch(e){reject(e);}});
 });
 req.on('error',reject);
 for(const chunk of chunks)req.write(chunk);
 req.end();
});
test('chunked UTF-8 over-limit invoke fails closed and next request works',async()=>{
 const port=await new Promise((resolve,reject)=>{
  const server=createServer();server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
   const p=server.address().port;server.close(()=>resolve(p));
  });
 });
 const child=spawn(process.execPath,[service],{env:{...process.env,
  ADA_INTERNAL_KEY:key,APP_PORT:String(port)},stdio:'ignore'});
 try{
  let ready=false;
  for(let i=0;i<80;i++){
   if(child.exitCode!==null)break;
   try{const r=await fetch('http://127.0.0.1:'+port+'/health',
    {signal:AbortSignal.timeout(250)});if(r.ok){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,30));
  }
  assert(ready,'service did not start');
  const observe=()=>send(port,[JSON.stringify({action:'danteworld.observe'})]);
  const before=await observe();
  assert.equal(before.status,200);
  const oversized=JSON.stringify({action:'danteworld.reset',
   params:{note:'界'.repeat(6000)}});
  assert(Buffer.byteLength(oversized)>16384);
  assert(oversized.length<16384);
  const payload=Buffer.from(oversized);
  const chunks=[];
  for(let offset=0;offset<payload.length;offset+=257)
   chunks.push(payload.subarray(offset,offset+257));
  const rejected=await send(port,chunks);
  assert.equal(rejected.status,413);
  assert.equal(rejected.body.error,'payload_too_large');
  assert.deepEqual(await observe(),before);
  const valid=await send(port,[JSON.stringify({action:'danteworld.apply',
   params:{command:{schema:'dante.motor.command.v1',tick:0,delta:1}}})]);
  assert.equal(valid.status,200);
  assert.equal(valid.body.result.position,1);
 }finally{
  child.kill();
  if(child.exitCode===null)await Promise.race([once(child,'exit'),
   new Promise(r=>setTimeout(r,1000))]);
 }
});
