import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const exe=fileURLToPath(new URL('../apps/danteworld/service.mjs',import.meta.url));
const key='dante-world-boundary-test-key-123456789';
test('oversized ASCII and UTF-8 invoke return 413 without world mutation',async()=>{
 const port=await new Promise((resolve,reject)=>{
  const s=createServer();s.on('error',reject);
  s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
 });
 const proc=spawn(process.execPath,[exe],{env:{...process.env,ADA_INTERNAL_KEY:key,APP_PORT:String(port)},stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 const call=async body=>fetch(base+'/invoke',{method:'POST',
  headers:{'X-Internal-Key':key,'Content-Type':'application/json'},body});
 try{
  let ready=false;
  for(let i=0;i<60;i++){
   try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(250)})).ok){ready=true;break;}}catch{}
   if(proc.exitCode!==null)break;
   await new Promise(r=>setTimeout(r,40));
  }
  assert(ready,'world service unavailable');
  const observe=async()=>{
   const r=await call(JSON.stringify({action:'danteworld.observe'}));
   assert.equal(r.status,200);
   return (await r.json()).result;
  };
  const initial=await observe();
  for(const payload of ['x'.repeat(17000),'界'.repeat(6000)]){
   const raw=JSON.stringify({action:'danteworld.reset',params:{note:payload}});
   assert(Buffer.byteLength(raw)>16384);
   const response=await call(raw);
   assert.equal(response.status,413);
   assert.equal((await response.json()).error,'payload_too_large');
   assert.deepEqual(await observe(),initial);
  }
  // The character count fits, but UTF-8 byte count exceeds the limit.
  const multi=JSON.stringify({action:'danteworld.reset',params:{note:'界'.repeat(5500)}});
  assert(multi.length<16384);
  assert(Buffer.byteLength(multi)>16384);
  const response=await call(multi);
  assert.equal(response.status,413);
  assert.deepEqual(await observe(),initial);
  const ok=await call(JSON.stringify({action:'danteworld.apply',
   params:{command:{schema:'dante.motor.command.v1',tick:0,delta:1}}}));
  assert.equal(ok.status,200);
  assert.equal((await ok.json()).result.position,1);
 }finally{
  proc.kill();if(proc.exitCode===null)
   await Promise.race([once(proc,'exit'),new Promise(r=>setTimeout(r,1000))]);
 }
});
