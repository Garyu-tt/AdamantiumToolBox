import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const key='test-only-'+('a'.repeat(30));
const port=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const wait=async url=>{for(let i=0;i<100;i++){
 try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,25));}
 throw Error('service_timeout');};
for(const a of [{id:'chat_turns',read:'chat_turns.status',params:{thread:'test-thread'},permission:'chat.turns.read'},
 {id:'chat_context',read:'chat_context.read',params:{thread:'test-thread'},permission:'chat.context.read'}]){
 const p=await port();const child=spawn(process.execPath,[new URL('../apps/'+a.id+'/service.mjs',import.meta.url).pathname],{
  env:{...process.env,APP_PORT:String(p),ADA_INTERNAL_KEY:key,ADA_CAPS:a.permission,
   ADA_APP_DATA_DIR:'/tmp/nonexistent-chat-hub-tests-'+process.pid},stdio:'pipe'});
 const url='http://127.0.0.1:'+p;
 try{await wait(url+'/health');
  assert.equal((await fetch(url+'/graph')).status,401);
  const headers={'X-Internal-Key':key,'Content-Type':'application/json'};
  const graph=await(await fetch(url+'/graph',{headers})).json();
  assert(graph.nodes.some(n=>n.id===a.id+'.provider'));
  const ok=await fetch(url+'/invoke',{method:'POST',headers,body:JSON.stringify({action:a.read,params:a.params})});
  assert.equal(ok.status,200);
  const denied=await fetch(url+'/invoke',{method:'POST',headers,body:JSON.stringify({
   action:a.id+'.'+(a.id==='chat_turns'?'claim':'save'),params:a.params})});
  assert.equal(denied.status,403);
  console.log('CONVERSATION_SERVICE_OK',a.id);
 }finally{child.kill('SIGTERM');}
}
