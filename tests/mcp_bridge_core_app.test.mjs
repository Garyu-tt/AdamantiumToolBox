import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {verify,createPublicKey} from 'node:crypto';
import {identity} from '../core/node_identity.mjs';
const source=resolve(import.meta.dirname,'..');
const auth='test-core-auth-long-and-unguessable';
const secret='test-app-internal-key-long-enough';
const bearer='test-mcp-external-bearer-long-enough';
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const pause=t=>new Promise(ok=>setTimeout(ok,t));
async function stop(p){if(!p||p.exitCode!==null||p.signalCode!==null)return;
 const done=once(p,'exit').catch(()=>{});p.kill();await Promise.race([done,pause(3000)]);}
async function rpc(url,id,name,args={}){
 const r=await fetch(url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json','Accept':'application/json, text/event-stream'},
 body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}})});
 assert.equal(r.status,200);return r.json();
}
test('Core and MCP Bridge work alone with signed identity and real graph invocation',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'mas-mcp-core-app-'));
 const root=join(tmp,'runtime'),home=join(tmp,'home'),registry=join(tmp,'nodes.json');
 const corePort=await free(),appPort=await free(),coreUrl='http://127.0.0.1:'+corePort;
 let core,app;const logs={core:'',app:''};
 try{
  await mkdir(join(root,'apps'),{recursive:true});
  await cp(join(source,'core'),join(root,'core'),{recursive:true});
  await cp(join(source,'packages','mcp_bridge'),join(root,'apps','mcp_bridge'),{recursive:true});
  await mkdir(join(root,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  const manifestPath=join(root,'apps','mcp_bridge','manifest.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  manifest.service.port=appPort;await writeFile(manifestPath,JSON.stringify(manifest));
  const meshPath=join(home,'Adamantium Toolbox','mesh'),me=await identity(meshPath);
  await writeFile(registry,JSON.stringify({schema:'adamantium.bridge.nodes.v1',nodes:[{
   id:'local_core',approved:true,urls:[coreUrl+'/'],tokenEnv:'ADA_TOKEN',
   allow:['mcp_bridge.status'],identity:{id:me.id,publicKey:me.publicKey}}]}));
  const env={...process.env,LOCALAPPDATA:home,ADA_MESH_IDENTITY_DIR:meshPath,
   ADA_TOKEN:auth,ADA_INTERNAL_KEY:secret,ADA_MCP_BEARER:bearer,ADA_BRIDGE_CONFIG:registry,
   ADA_CAPS:'mcp_bridge.read',ADA_PORT:String(corePort),APP_PORT:String(appPort)};
  core=spawn(process.execPath,[join(root,'core','kernel.mjs')],{env,stdio:['ignore','ignore','pipe'],windowsHide:true});
  app=spawn(process.execPath,[join(root,'apps','mcp_bridge','service.mjs')],{env,stdio:['ignore','ignore','pipe'],windowsHide:true});
  for(const [name,child] of [['core',core],['app',app]])child.stderr.on('data',d=>{logs[name]=(logs[name]+d).slice(-3000);});
  let graph;
  for(let i=0;i<120;i++){
   if(core.exitCode!==null||app.exitCode!==null)throw Error('failed_to_start: '+JSON.stringify(logs));
   try{const r=await fetch(coreUrl+'/api/graph',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(300)});
    if(r.ok){graph=await r.json();if(graph.nodes.some(x=>x.id==='mcp_bridge.status'))break;}}
   catch{}await pause(100);
  }
  assert(graph?.nodes?.some(x=>x.id==='mcp_bridge.status'),'Core graph unavailable: '+JSON.stringify(logs));
  assert(graph.nodes.every(x=>x.id.startsWith('mcp_bridge.')),'Core imported an optional application');
  assert.equal((await fetch(coreUrl+'/api/identity?challenge='+('a'.repeat(48)))).status,401);
  const signedRes=await fetch(coreUrl+'/api/identity?challenge='+('a'.repeat(48)),{headers:{Authorization:'Bearer '+auth}});
  assert.equal(signedRes.status,200);const signed=await signedRes.json();assert.equal(signed.id,me.id);
  const proof='adamantium.core.identity.v1\n'+signed.id+'\n'+signed.challenge;
  assert(verify(null,Buffer.from(proof),createPublicKey(me.publicKey),Buffer.from(signed.signature,'base64')));
  const mcp='http://127.0.0.1:'+appPort;
  const nodesResp=await rpc(mcp,1,'adamantium_nodes');
  const nodes=JSON.parse(nodesResp.result.content[0].text);
  assert.equal(nodes.length,1);assert.equal(nodes[0].identity,'verified');
  assert.deepEqual(nodes[0].nodes.filter(x=>x.type==='action').map(x=>x.id),['mcp_bridge.status']);
  const allowed=await rpc(mcp,2,'adamantium_invoke',{node_id:'local_core',action:'mcp_bridge.status'});
  assert.equal(allowed.result.isError,false,JSON.stringify(allowed));
  assert.equal(JSON.parse(allowed.result.content[0].text).result.result.status,'ready');
  const blocked=await rpc(mcp,3,'adamantium_invoke',{node_id:'local_core',action:'browser.click'});
  assert.equal(blocked.result.isError,true);
  const wrong=await fetch(coreUrl+'/api/invoke',{method:'POST',
   headers:{Authorization:'Bearer '+auth,'X-Adamantium-Target-Node':'00000000-0000-0000-0000-000000000000','Content-Type':'application/json'},
   body:JSON.stringify({action:'mcp_bridge.status'})});
  assert.equal(wrong.status,409);
 }finally{await Promise.all([stop(app),stop(core)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:150});}
});
