import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=await mkdtemp(join(tmpdir(),'leonardo-runtime-'));
const token='leonardo-test-token-with-sufficient-length';
const secret='leonardo-test-internal-key-with-sufficient-length';
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const free=()=>new Promise(ok=>{
 const server=createServer();server.listen(0,'127.0.0.1',()=>{
  const port=server.address().port;server.close(()=>ok(port));
 });
});
const ports={core:await free(),leonardo:await free(),leonardo_cpu:await free()},children=[];
const base='http://127.0.0.1:'+ports.core;
async function invoke(action,params){
 const r=await fetch(base+'/api/invoke',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({action,params}),signal:AbortSignal.timeout(10000)});
 const answer=await r.json();if(!r.ok)throw Error(answer.error);
 return answer.result;
}
try{
 await cp(join(source,'core'),join(home,'core'),{recursive:true});
 await cp(join(source,'standards'),join(home,'standards'),{recursive:true});
 await mkdir(join(home,'apps'),{recursive:true});
 for(const app of ['leonardo','leonardo_cpu']){
  await cp(join(source,'apps',app),join(home,'apps',app),{recursive:true});
  const path=join(home,'apps',app,'manifest.json');
  const manifest=JSON.parse(await readFile(path,'utf8'));
  manifest.service.port=ports[app];await writeFile(path,JSON.stringify(manifest));
 }
 const env={...process.env,LOCALAPPDATA:join(home,'userdata'),ADA_TOKEN:token,
  ADA_INTERNAL_KEY:secret,ADA_PORT:String(ports.core),ADA_CORE_URL:base,
  ADA_CAPS:'graphics.read,graphics.generate,graphics.icons,graphics.provider,graph.read'};
 await mkdir(env.LOCALAPPDATA,{recursive:true});
 for(const app of ['leonardo','leonardo_cpu']){
  const child=spawn(process.execPath,[join(home,'apps',app,'service.mjs')],{
   env:{...env,APP_PORT:String(ports[app])},stdio:'ignore'});
  children.push(child);
 }
 children.push(spawn(process.execPath,[join(home,'core','kernel.mjs')],{env,stdio:'ignore'}));
 let found=false;
 for(let i=0;i<70;i++){
  try{
   const r=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
   const doc=await r.json();
   if(doc.nodes.some(n=>n.id==='leonardo.icon-assets')&&
      doc.nodes.some(n=>n.id==='leonardo_cpu.provider')){found=true;break;}
  }catch{}
  assert(children.every(p=>p.exitCode===null),'service_exited_early');await pause(100);
 }
 assert(found,'graphics_services_not_discovered');
 const created=await invoke('leonardo.icons.regenerate',{key:'editor',prompt:'pencil'});
 assert.equal(created.status,'completed');assert.equal(created.revision,1);
 const catalog=await invoke('leonardo.icons.catalog',{});
 assert.equal(catalog.items.editor.sha256,created.sha256);
 assert(!('dataUri' in catalog.items.editor));
 const icon=await invoke('leonardo.icons.get',{key:'editor'});
 assert.equal(icon.found,true);assert.equal(icon.sha256,created.sha256);
 assert(icon.dataUri.startsWith('data:image/png;base64,'));
 console.log('LEONARDO_RUNTIME_OK Core + Router + CPU provider regeneration and metadata');
}finally{
 for(const child of children)if(child.exitCode===null){
  child.kill();await Promise.race([once(child,'exit'),pause(2500)]);
 }
 await rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
