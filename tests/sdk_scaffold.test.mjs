import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {generateApp} from '../sdk/generate.mjs';
import {validateManifest} from '../core/contract.mjs';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const tmp=await mkdtemp(join(tmpdir(),'sdk-app-'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const children=[];
const token='test-sdk-local-token-12345678',secret='test-sdk-internal-key-12345678';
const free=()=>new Promise(done=>{const server=createServer();
 server.listen(0,'127.0.0.1',()=>{const port=server.address().port;
  server.close(()=>done(port));});});
try{
 await mkdir(join(tmp,'drafts'));
 const servicePort=await free();let corePort=await free();
 while(corePort===servicePort)corePort=await free();
 const {directory}=await generateApp(tmp,{id:'fixture',name:'Generated Fixture',port:servicePort});
 assert(validateManifest(JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'))));
 await assert.rejects(generateApp(tmp,{id:'fixture',port:servicePort}),{code:'EEXIST'});
 await assert.rejects(generateApp(tmp,{id:'../escape',port:servicePort}),/invalid_generator_options/);
 await cp(join(source,'core'),join(tmp,'core'),{recursive:true});
 await mkdir(join(tmp,'apps'));await cp(directory,join(tmp,'apps','fixture'),{recursive:true});
 await mkdir(join(tmp,'interface'));
 const base='http://127.0.0.1:'+corePort;
 const env={...process.env,LOCALAPPDATA:join(tmp,'home'),ADA_TOKEN:token,
  ADA_INTERNAL_KEY:secret,ADA_CAPS:'fixture.read',ADA_PORT:String(corePort),
  APP_PORT:String(servicePort)};
 await mkdir(env.LOCALAPPDATA);
 for(const path of [join(tmp,'apps','fixture','service.mjs'),join(tmp,'core','kernel.mjs')])
  children.push(spawn(process.execPath,[path],{env,stdio:'ignore'}));
 let graph;
 for(let i=0;i<75;i++){
  try{const response=await fetch(base+'/api/graph',{
   headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(300)});
   if(response.ok){graph=await response.json();if(graph.nodes.length)break;}}
  catch{}
  assert(children.every(c=>c.exitCode===null),'process_exited');await pause(100);
 }
 assert.deepEqual(graph.nodes.map(n=>n.id).sort(),['fixture.ping','fixture.view']);
 const action=await fetch(base+'/api/invoke',{method:'POST',headers:{Authorization:'Bearer '+token,
  'Content-Type':'application/json'},body:JSON.stringify({action:'fixture.ping'})});
 assert.equal(action.status,200);assert.deepEqual((await action.json()).result,{pong:true});
 const typed=async(params)=>fetch(base+'/api/invoke',{method:'POST',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({action:'fixture.ping',params})});
 assert.equal((await typed({unexpected:true})).status,422);
 const typeFile=join(tmp,'apps','fixture','modules.json');
 const typedDoc=JSON.parse(await readFile(typeFile,'utf8'));
 typedDoc.modules[0].provides[1].output={type:'object',required:['pong'],
  properties:{pong:{type:'string'}},additionalProperties:false};
 await writeFile(typeFile,JSON.stringify(typedDoc));
 assert.equal((await typed({})).status,502);
 typedDoc.modules[0].provides[1].output={type:'object',required:['pong'],
  properties:{pong:{type:'boolean'}}};
 typedDoc.modules[0].provides[1].input={type:'object',pattern:'unsupported'};
 await writeFile(typeFile,JSON.stringify(typedDoc));
 const badSchema=await fetch('http://127.0.0.1:'+servicePort+'/graph',{
  headers:{'X-Internal-Key':secret}});
 assert.equal(badSchema.status,503);
 typedDoc.modules[0].provides[1].input={type:'object',additionalProperties:false};
 await writeFile(typeFile,JSON.stringify(typedDoc));
 const path=join(tmp,'apps','fixture','modules.json');
 const modules=JSON.parse(await readFile(path,'utf8'));
 modules.modules[0].children=[{id:'fixture.nested',kind:'submodule',version:'0.1.0',
  provides:[{id:'fixture.extra',type:'resource',title:'Extra',version:'1.0.0',
   permissions:['fixture.read']}],consumes:[{id:'fixture.ping',version:'^1.0.0',
   optional:false}]}];
 await writeFile(path,JSON.stringify(modules));
 const active=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
 assert.deepEqual((await active.json()).nodes.map(n=>n.id).sort(),
  ['fixture.extra','fixture.ping','fixture.view']);
 modules.modules[0].children[0].consumes[0].version='^2.0.0';
 await writeFile(path,JSON.stringify(modules));
 const incompatible=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
 assert.deepEqual((await incompatible.json()).nodes.map(n=>n.id).sort(),
  ['fixture.ping','fixture.view']);
 modules.modules[0].children[0].consumes[0].version='^1.0.0';
 modules.modules[0].children[0].provides[0].permissions=['foreign.admin'];
 await writeFile(path,JSON.stringify(modules));
 const invalid=await fetch('http://127.0.0.1:'+servicePort+'/graph',{
  headers:{'X-Internal-Key':secret}});
 assert.equal(invalid.status,503); // malformed live spec fails closed
 modules.modules[0].children[0].provides[0].permissions=['fixture.read'];
 modules.modules[0].enabled=false;
 await writeFile(path,JSON.stringify(modules));
 const changed=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token}});
 assert.deepEqual((await changed.json()).nodes,[]);
 const denied=await fetch(base+'/api/invoke',{method:'POST',headers:{Authorization:'Bearer '+token,
  'Content-Type':'application/json'},body:JSON.stringify({action:'fixture.ping'})});
 assert.equal(denied.status,403); // capability disappears before routing
 console.log('SDK_SCAFFOLD_OK Core+App live capability removal no sdk runtime dependency');
}finally{
 for(const child of children)if(child.exitCode===null){child.kill();
  await Promise.race([once(child,'exit'),pause(2000)]);}
 await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
