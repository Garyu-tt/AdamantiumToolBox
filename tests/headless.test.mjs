import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer as tcpServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {validateManifest,validateGraph} from '../core/contract.mjs';
import {catalog} from '../core/catalog.mjs';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const free=()=>new Promise(ok=>{const s=tcpServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const root=await mkdtemp(join(tmpdir(),'mas-headless-'));
const id='client_watchdog',appPort=await free(),corePort=await free();
const manifest={mas:'1.0',id,name:'Client Watchdog',version:'0.1.0',
 lifecycle:'independent',service:{protocol:'mas-http-1',port:appPort},
 ui:{standard:'mas-ui-1',mode:'headless'},auth:{mode:'host-delegated'},
 permissions:['client_watchdog.read'],events:{schema:'mas-event-1'},
 data:{refs:'mas-ref-1'},updates:{strategy:'semver',migrations:[]}};
const graph={app:id,version:1,nodes:[{id:id+'.status',type:'action',
 requires:['client_watchdog.read']}],edges:[]};
assert(validateManifest(manifest));
assert(validateGraph(graph,manifest));
assert(!validateGraph({...graph,nodes:[{id:id+'.view',type:'view',title:'Bad',
 requires:[]}]},manifest));
assert(!validateManifest({...manifest,ui:{standard:'mas-ui-1',mode:'unknown'}}));
let app,core;
try{
 await cp(join(source,'core'),join(root,'core'),{recursive:true});
 const dir=join(root,'apps',id);await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest));
 await writeFile(join(dir,'service.mjs'),`import http from 'node:http';
 const id='client_watchdog',g=${JSON.stringify(graph)};
 http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');
 if(req.url==='/health')res.end(JSON.stringify({app:id}));
 else if(req.url==='/graph')res.end(JSON.stringify(g));
 else if(req.url==='/invoke')res.end(JSON.stringify({ok:true,source:'headless'}));
 else{res.statusCode=404;res.end('{}');}
 }).listen(Number(process.env.APP_PORT),'127.0.0.1');`);
 assert.equal((await catalog(root)).length,1);
 const env={...process.env,LOCALAPPDATA:join(root,'home'),
 ADA_TOKEN:'test-headless-token-has-sufficient-length',
 ADA_INTERNAL_KEY:'test-headless-key-has-sufficient-length',
 ADA_CAPS:'client_watchdog.read,graph.read',ADA_PORT:String(corePort),
 APP_PORT:String(appPort)};
 app=spawn(process.execPath,[join(dir,'service.mjs')],{env,stdio:'ignore'});
 core=spawn(process.execPath,[join(root,'core','kernel.mjs')],{env,stdio:'ignore'});
 const base='http://127.0.0.1:'+corePort;
 let nodes=[];
 for(let i=0;i<60;i++){
  try{const r=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+env.ADA_TOKEN},
   signal:AbortSignal.timeout(500)});if(r.ok){nodes=(await r.json()).nodes;if(nodes.length)break;}}catch{}
  if(app.exitCode!==null||core.exitCode!==null)throw Error('service_exit');
  await pause(100);
 }
 assert.deepEqual(nodes.map(n=>n.id),[id+'.status']);
 assert(!nodes.some(n=>n.type==='view'));
 const bad=await fetch(base+'/api/graph');assert.equal(bad.status,401);
 const invoke=await fetch(base+'/api/invoke',{method:'POST',
  headers:{Authorization:'Bearer '+env.ADA_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({action:id+'.status',params:{}})});
 assert.deepEqual(await invoke.json(),{ok:true,source:'headless'});
 console.log('HEADLESS_CORE_APP_OK no UI, authenticated action, isolated');
}finally{
 for(const child of [app,core])if(child&&!child.killed&&child.exitCode===null){
  child.kill();await Promise.race([once(child,'exit'),pause(2000)]);
 }
 await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:150});
}
