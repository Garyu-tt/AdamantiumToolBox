import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {catalog} from '../core/catalog.mjs';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const pause=t=>new Promise(ok=>setTimeout(ok,t));
const auth='test-token-is-long-enough-for-local-auth';
const secret='test-internal-key-is-long-enough-for-local-auth';
async function isolated(id){
 const root=await mkdtemp(join(tmpdir(),'mas-core-app-')),home=join(root,'home');
 const corePort=await free(),appPort=await free();
 const service=join(root,'apps',id,'service.mjs');
 let app,core;
 try{
  await mkdir(join(root,'apps'),{recursive:true});
  await cp(join(source,'core'),join(root,'core'),{recursive:true});
  await cp(join(source,'apps',id),join(root,'apps',id),{recursive:true});
  await mkdir(join(root,'interface'),{recursive:true});
  await mkdir(home,{recursive:true});
  const manifest=join(root,'apps',id,'manifest.json');
  const m=JSON.parse(await readFile(manifest,'utf8'));
  m.service.port=appPort;await writeFile(manifest,JSON.stringify(m));
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:auth,ADA_INTERNAL_KEY:secret,
   ADA_CAPS:m.permissions.join(',')+',graph.read,frontend.read,frontend.write,semantic.read',
   ADA_PORT:String(corePort),APP_PORT:String(appPort),ADA_BROWSER_EXECUTABLE:process.execPath,
   ADA_CORE_URL:'http://127.0.0.1:'+corePort};
  app=spawn(process.execPath,[service],{env,stdio:'ignore',windowsHide:true});
  core=spawn(process.execPath,[join(root,'core','kernel.mjs')],{env,stdio:'ignore',windowsHide:true});
  const base='http://127.0.0.1:'+corePort;
  let graph;
  for(let i=0;i<60;i++){
   try{
    const res=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(300)});
    if(res.ok){graph=await res.json();if(graph.nodes.length)break;}
   }catch{}
   if(app.exitCode!==null||core.exitCode!==null)throw Error(id+'_failed_to_start');
   await pause(100);
  }
  assert(graph?.nodes?.length,id+' has no capabilities');
  if(m.ui?.mode==='headless')assert(!graph.nodes.some(n=>n.type==='view'),id+' exposes a view');
  else assert(graph.nodes.some(n=>n.id===id+'.view'),id+' has no own view');
  assert(graph.nodes.every(n=>n.id.startsWith(id+'.')),'cross_app_dependency');
  const response=await fetch('http://127.0.0.1:'+appPort+'/health');
  assert.equal((await response.json()).app,id);
  console.log('CORE_APP_ISOLATED_OK',id,graph.nodes.length,'capabilities');
 }finally{
  for(const child of [app,core])if(child?.exitCode===null){
   child.kill();await Promise.race([once(child,'exit'),pause(3000)]);
  }
  await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:150});
 }
}
const bundled=(await catalog(source)).filter(app=>app.source==='bundled');
for(const app of bundled)await isolated(app.id);
