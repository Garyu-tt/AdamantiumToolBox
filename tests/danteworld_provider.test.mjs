import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const exe=fileURLToPath(new URL('../apps/danteworld/service.mjs',import.meta.url));
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.on('error',reject);
 server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});
});
const secret='test-only-internal-key-123456789';
const proc=spawn(process.execPath,[exe],{env:{...process.env,ADA_INTERNAL_KEY:secret,APP_PORT:String(port)},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
const call=async(action,params={})=>{
 const r=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action,params})});
 return {code:r.status,body:await r.json()};
};
try{
 let ready=false;
 for(let i=0;i<60;i++){
  try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(250)});if(r.ok){ready=true;break;}}catch{}
  if(proc.exitCode!==null)break;
  await new Promise(r=>setTimeout(r,40));
 }
 assert(ready,'fixture service did not start');
 assert.equal((await fetch(base+'/graph')).status,401);
 const spec=await (await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}})).json();
 assert.equal(spec.app,'danteworld');
 assert.equal(spec.nodes.find(n=>n.id==='danteworld.observe')?.contract,'dante.world.observe.v1');
 assert.equal(spec.nodes.find(n=>n.id==='danteworld.apply')?.fixture,true);
 let r=await call('danteworld.observe');assert.equal(r.body.result.tick,0);
 r=await call('danteworld.apply',{command:{schema:'dante.motor.command.v1',tick:0,delta:1}});
 assert.equal(r.code,200);assert.equal(r.body.result.position,1);assert.equal(r.body.result.tick,1);
 const shot=(await call('danteworld.snapshot')).body.result;
 const bad=await call('danteworld.apply',{command:{schema:'dante.motor.command.v1',tick:0,delta:1}});
 assert.equal(bad.code,400);
 await call('danteworld.reset');assert.equal((await call('danteworld.observe')).body.result.position,0);
 r=await call('danteworld.restore',{snapshot:shot});assert.equal(r.body.result.position,1);
 r=await call('danteworld.restore',{snapshot:{...shot,error:999}});assert.equal(r.code,400);
 assert.equal((await call('danteworld.observe')).body.result.position,1,'bad restore must not overwrite');
 assert.equal((await call('danteworld.launch')).code,400,'no fake brain launch');
 console.log('DANTE_WORLD_PROVIDER_SMOKE_OK auth snapshot restore invalid ticks and safe fixture');
}finally{
 proc.kill();if(proc.exitCode===null)await Promise.race([once(proc,'exit'),new Promise(r=>setTimeout(r,1000))]);
}
