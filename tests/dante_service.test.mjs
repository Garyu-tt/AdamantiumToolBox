import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const exe=fileURLToPath(new URL('../apps/dante/service.mjs',import.meta.url));
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.on('error',reject);
 server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});
});
const secret='test-internal-key-at-least-24-characters';
const proc=spawn(process.execPath,[exe],{env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
try{
 let live=false;
 for(let i=0;i<50;i++){
  try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(400)})).ok){live=true;break;}}catch{}
  if(proc.exitCode!==null)break;
  await new Promise(r=>setTimeout(r,40));
 }
 assert(live,'service_not_started');
 assert.equal((await fetch(base+'/graph')).status,401);
 const res=await fetch(base+'/graph',{headers:{'X-Internal-Key':secret}});
 assert.equal(res.status,200);
 const graph=await res.json();
 assert.equal(graph.app,'dante');
 assert(graph.nodes.some(n=>n.id==='dante.view'));
 const run=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action:'dante.status'})});
 assert.equal(run.status,200);
 const body=await run.json();
 assert.equal(body.result.live,false);
 assert.equal(body.result.genesisVerified,false);
 const no=await fetch(base+'/invoke',{method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action:'dante.launch'})});
 assert.equal(no.status,404);
 console.log('DANTE_SERVICE_SMOKE_OK safe_nonlaunch');
}finally{
 proc.kill();if(proc.exitCode===null)await Promise.race([once(proc,'exit'),new Promise(r=>setTimeout(r,1000))]);
}
