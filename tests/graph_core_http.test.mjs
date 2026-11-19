import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const root=resolve(import.meta.dirname,'..');
const temp=createServer();
await new Promise(ok=>temp.listen(0,'127.0.0.1',ok));
const port=temp.address().port;
await new Promise(ok=>temp.close(ok));
const token='local_core_fixture_bearer_0123456789',secret='local_core_internal_fixture_0123456789';
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['core/kernel.mjs'],{
 cwd:root,stdio:'ignore',env:{...process.env,ADA_PORT:String(port),ADA_TOKEN:token,
  ADA_INTERNAL_KEY:secret,ADA_CAPS:''}});
const ctrl=new AbortController();
try {
 let healthy=false;
 for(let i=0;i<60;i++) {
  if(child.exitCode!==null)throw Error('core_exited_before_health');
  try {healthy=(await fetch(base+'/health',{signal:AbortSignal.timeout(300)})).ok;}
  catch {}
  if(healthy)break;
  await sleep(100);
 }
 assert(healthy,'core_start_timeout');
 const denied=await fetch(base+'/api/events');assert.equal(denied.status,401);
 const stream=await fetch(base+'/api/events',{
  headers:{Authorization:'Bearer '+token},signal:ctrl.signal});
 assert.equal(stream.status,200);
 assert.match(stream.headers.get('content-type')||'',/text\/event-stream/);
 const reader=stream.body.getReader();
 let initial=new TextDecoder().decode((await reader.read()).value);
 assert.match(initial,/event: ready/);
 const forbidden=await fetch(base+'/api/internal/graph-invalidated',{method:'POST'});
 assert.equal(forbidden.status,401);
 const triggered=await fetch(base+'/api/internal/graph-invalidated',{
  method:'POST',headers:{'X-Internal-Key':secret}});
 assert.equal(triggered.status,202);
 assert.equal((await triggered.json()).revision,1);
 let event='',attempt=0;
 while(!event.includes('event: invalidate')&&attempt++<12) {
  const next=await Promise.race([reader.read(),sleep(1500).then(()=>{throw Error('sse_timeout');})]);
  if(next.done)throw Error('sse_disconnected');
  event+=new TextDecoder().decode(next.value);
 }
 assert.match(event,/id: 1\nevent: invalidate/);
 console.log('MAS_CORE_SSE_OK authenticated real kernel event routes');
} finally {
 ctrl.abort();
 child.kill();
 await sleep(100);
}
