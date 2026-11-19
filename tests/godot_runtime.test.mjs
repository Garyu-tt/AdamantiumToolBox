import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const tmp=await mkdtemp(join(tmpdir(),'godot-runtime-'));
const token='godot-test-token-with-sufficient-length';
const secret='godot-test-internal-with-sufficient-length';
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
const free=()=>new Promise(ok=>{
 const server=createServer();server.listen(0,'127.0.0.1',()=>{
  const port=server.address().port;server.close(()=>ok(port));
 });
});
const ports={core:await free(),godot:await free(),godot_local:await free()},children=[];
const base='http://127.0.0.1:'+ports.core;
async function invoke(action,params){
 const r=await fetch(base+'/api/invoke',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({action,params}),signal:AbortSignal.timeout(6000)});
 const answer=await r.json();if(!r.ok)throw Error(answer.error);
 return answer.result;
}
try{
 await cp(join(source,'core'),join(tmp,'core'),{recursive:true});
 await cp(join(source,'standards'),join(tmp,'standards'),{recursive:true});
 await mkdir(join(tmp,'apps'),{recursive:true});
 for(const app of ['godot','godot_local']){
  await cp(join(source,'apps',app),join(tmp,'apps',app),{recursive:true});
  const path=join(tmp,'apps',app,'manifest.json');
  const m=JSON.parse(await readFile(path,'utf8'));
  m.service.port=ports[app];await writeFile(path,JSON.stringify(m));
 }
 const env={...process.env,LOCALAPPDATA:join(tmp,'userdata'),ADA_TOKEN:token,
  ADA_INTERNAL_KEY:secret,ADA_PORT:String(ports.core),ADA_CORE_URL:base,
  ADA_CAPS:'godot.read,godot.launch,engine.provider,engine.launch,graph.read'};
 await mkdir(env.LOCALAPPDATA,{recursive:true});
 for(const app of ['godot','godot_local'])
  children.push(spawn(process.execPath,[join(tmp,'apps',app,'service.mjs')],
   {env:{...env,APP_PORT:String(ports[app])},stdio:'ignore'}));
 children.push(spawn(process.execPath,[join(tmp,'core','kernel.mjs')],{env,stdio:'ignore'}));
 let ready=false;
 for(let i=0;i<70;i++){
  try{
   const r=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
   const graph=await r.json();
   if(graph.nodes.some(n=>n.id==='godot.world')&&
    graph.nodes.some(n=>n.id==='godot_local.provider')){ready=true;break;}
  }catch{}
  assert(children.every(p=>p.exitCode===null),'service_exited_early');await delay(100);
 }
 assert(ready,'godot_services_not_discovered');
 const all=await invoke('godot.providers',{});
 assert.equal(all.length,1);assert.equal(all[0].id,'godot_local.provider');
 assert.equal(all[0].operations['session.start'],undefined);
 const response=await invoke('godot.engine.inspect',{providerId:all[0].id});
 assert.equal(response.configured,false);
 assert.equal(response.reason,'godot_executable_not_configured');
 await assert.rejects(invoke('godot.session.start',{projectId:'x',profile:'headless'}),
  /upstream_400|core_http_400/);
 console.log('GODOT_RUNTIME_OK Core + router + optional local backend');
}finally{
 for(const child of children)if(child.exitCode===null){
  child.kill();await Promise.race([once(child,'exit'),delay(2500)]);
 }
 await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
