import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=await mkdtemp(join(tmpdir(),'vector-routing-'));
const token='vector-tests-owner-bearer-sufficient-length';
const secret='vector-tests-internal-secret-sufficient-length';
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const free=()=>new Promise(ok=>{
 const server=createServer();server.listen(0,'127.0.0.1',()=>{
  const port=server.address().port;server.close(()=>ok(port));
 });
});
const ports={core:await free(),leonardo:await free(),leonardo_vector:await free()};
const children=[],base='http://127.0.0.1:'+ports.core;
async function invoke(action,params){
 const r=await fetch(base+'/api/invoke',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({action,params}),signal:AbortSignal.timeout(15000)});
 const answer=await r.json();if(!r.ok)throw Error(answer.error);
 return answer.result;
}
try{
 await cp(join(source,'core'),join(home,'core'),{recursive:true});
 await cp(join(source,'standards'),join(home,'standards'),{recursive:true});
 await mkdir(join(home,'apps'),{recursive:true});
 for(const app of ['leonardo','leonardo_vector']){
  await cp(join(source,'apps',app),join(home,'apps',app),{recursive:true});
  const file=join(home,'apps',app,'manifest.json');
  const manifest=JSON.parse(await readFile(file,'utf8'));
  manifest.service.port=ports[app];await writeFile(file,JSON.stringify(manifest));
 }
 const env={...process.env,LOCALAPPDATA:join(home,'userdata'),ADA_TOKEN:token,
  ADA_INTERNAL_KEY:secret,ADA_PORT:String(ports.core),ADA_CORE_URL:base,
  ADA_CAPS:'graphics.read,graphics.generate,graphics.icons,graphics.provider,graph.read'};
 await mkdir(env.LOCALAPPDATA,{recursive:true});
 for(const app of ['leonardo','leonardo_vector']){
  children.push(spawn(process.execPath,[join(home,'apps',app,'service.mjs')],{
   env:{...env,APP_PORT:String(ports[app])},stdio:'ignore'}));
 }
 children.push(spawn(process.execPath,[join(home,'core','kernel.mjs')],{env,stdio:'ignore'}));
 let found=false;
 for(let i=0;i<80;i++){
  try{
   const r=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
   const doc=await r.json();
   if(doc.nodes.some(n=>n.id==='leonardo.generate')&&
      doc.nodes.some(n=>n.id==='leonardo_vector.provider')){found=true;break;}
  }catch{}
  assert(children.every(p=>p.exitCode===null),'service_exited_early');await pause(100);
 }
 assert(found,'vector_provider_not_discovered');
 const created=await invoke('leonardo.generate',{kind:'render',prompt:'Core & rendering',
  format:'image/svg+xml',options:{width:320,height:160,scene:[
   {type:'rect',x:4,y:4,width:80,height:30,fill:'#335577'},
   {type:'text',x:10,y:22,text:'<Core>',fill:'#ffffff'}]}});
 assert.equal(created.providerId,'leonardo_vector.provider');
 assert.equal(created.status,'completed');
 assert.equal(created.artifact.mime,'image/svg+xml');
 const svg=Buffer.from(created.artifact.data,'base64').toString('utf8');
 assert(svg.includes('&lt;Core&gt;'));assert(!svg.includes('<Core>'));
 console.log('LEONARDO_VECTOR_ROUTING_OK Core plus router plus optional CPU SVG');
}finally{
 for(const child of children)if(child.exitCode===null){
  child.kill();await Promise.race([once(child,'exit'),pause(2500)]);
 }
 await rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
