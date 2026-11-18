import {strict as assert} from 'node:assert';
import {cp,mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const temp=await mkdtemp(join(tmpdir(),'composer-runtime-'));
const free=()=>new Promise(ok=>{const server=createServer();
 server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>ok(p));});});
const corePort=await free(),composerPort=await free(),children=[];
const auth='test-composer-token-with-safe-length',secret='test-composer-internal-key-with-safe-length';
const base='http://127.0.0.1:'+corePort,pause=ms=>new Promise(ok=>setTimeout(ok,ms));
try{
 for(const path of ['core','standards','apps/ui_composer']){
  await cp(join(root,path),join(temp,path),{recursive:true});
 }
 const manifestPath=join(temp,'apps/ui_composer/manifest.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 manifest.service.port=composerPort;await writeFile(manifestPath,JSON.stringify(manifest));
 const env={...process.env,LOCALAPPDATA:join(temp,'private'),ADA_TOKEN:auth,
  ADA_INTERNAL_KEY:secret,ADA_CAPS:'ui.compose',ADA_PORT:String(corePort)};
 await mkdir(env.LOCALAPPDATA,{recursive:true});
 children.push(spawn(process.execPath,[join(temp,'apps/ui_composer/service.mjs')],{
  env:{...env,APP_PORT:String(composerPort)},stdio:'ignore'}));
 children.push(spawn(process.execPath,[join(temp,'core/kernel.mjs')],{env,stdio:'ignore'}));
 let graph=null;
 for(let i=0;i<70;i++){
  try{const r=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+auth}});
   graph=await r.json();
   if(graph.nodes.some(n=>n.id==='ui_composer.plan'))break;
  }catch{}
  assert(children.every(c=>c.exitCode===null),'service_exited_early');await pause(100);
 }
 assert(graph?.nodes.some(n=>n.id==='ui_composer.provider'),'composer_not_discovered');
 const schema={schema:'mas-ui-schema-1',app:'example',elements:[
  {id:'prompt',role:'field'},{id:'submit',role:'action'}]};
 const r=await fetch(base+'/api/invoke',{method:'POST',headers:{
  Authorization:'Bearer '+auth,'Content-Type':'application/json'},
  body:JSON.stringify({action:'ui_composer.plan',params:{schema,mode:'automatic'}})});
 const payload=await r.json();
 assert.equal(r.status,200);assert.equal(payload.result.schema,'mas-ui-plan-1');
 assert.deepEqual(payload.result.sections[0].items,['prompt','submit']);
 console.log('UI_COMPOSER_RUNTIME_OK isolated Core and optional composer');
}finally{
 for(const child of children)if(child.exitCode===null){
  child.kill();await Promise.race([once(child,'exit'),pause(2500)]);
 }
 await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
