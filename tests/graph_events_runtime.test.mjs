import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const free=()=>new Promise(done=>{const s=createServer();
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p));});});
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const root=await mkdtemp(join(tmpdir(),'mas-events-'));
const children=[],token='events-test-token-very-long-12345';
const secret='events-test-internal-secret-12345';
let abort;
try{
 const corePort=await free();let appPort=await free();
 while(appPort===corePort)appPort=await free();
 await cp(join(source,'core'),join(root,'core'),{recursive:true});
 await mkdir(join(root,'apps'));await mkdir(join(root,'interface'));
 await cp(join(source,'apps','editor'),join(root,'apps','editor'),{recursive:true});
 const file=join(root,'apps','editor','manifest.json');
 const manifest=JSON.parse(await readFile(file,'utf8'));
 manifest.service.port=appPort;await writeFile(file,JSON.stringify(manifest));
 const env={...process.env,LOCALAPPDATA:join(root,'local'),ADA_PORT:String(corePort),
  APP_PORT:String(appPort),ADA_TOKEN:token,ADA_INTERNAL_KEY:secret,
  ADA_CAPS:'workspace.read',ADA_GRAPH_EVENT_POLL_MS:'250'};
 await mkdir(env.LOCALAPPDATA);
 children.push(spawn(process.execPath,[join(root,'core','kernel.mjs')],{env,stdio:'ignore'}));
 const base='http://127.0.0.1:'+corePort;
 for(let i=0;i<70;i++){
  try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(300)})).ok)break;}catch{}
  if(children[0].exitCode!==null)throw Error('core_exited');await pause(80);
 }
 const denied=await fetch(base+'/api/graph/events');
 assert.equal(denied.status,401);
 abort=new AbortController();
 const response=await fetch(base+'/api/graph/events',{headers:{
  Authorization:'Bearer '+token,Accept:'text/event-stream'},
  signal:abort.signal});
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/text\/event-stream/);
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='';
 async function next(){
  while(true){
   const end=buffer.indexOf('\n\n');
   if(end>=0){
    const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
    if(frame.includes('event: graph_changed')){
     const data=frame.split('\n').find(s=>s.startsWith('data:'));
     return JSON.parse(data.slice(5)).revision;
    }continue;
   }
   const chunk=await reader.read();assert(!chunk.done,'event_stream_closed');
   buffer+=decoder.decode(chunk.value,{stream:true}).replace(/\r/g,'');
  }
 }
 const first=await next();assert.match(first,/^[0-9a-f]{64}$/);
 children.push(spawn(process.execPath,[join(root,'apps','editor','service.mjs')],{
  env,stdio:'ignore'}));
 const second=await next();assert.notEqual(second,first);
 const graph=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
 assert((await graph.json()).nodes.some(n=>n.id==='editor.view'));
 children[1].kill();await once(children[1],'exit');
 const third=await next();assert.notEqual(third,second);
 const now=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
 assert.equal((await now.json()).nodes.length,0);
 console.log('GRAPH_EVENTS_RUNTIME_OK auth live add/remove SSE Core+App');
}finally{
 abort?.abort();
 for(const child of children)if(child.exitCode===null){child.kill();
  await Promise.race([once(child,'exit'),pause(3000)]);}
 await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
