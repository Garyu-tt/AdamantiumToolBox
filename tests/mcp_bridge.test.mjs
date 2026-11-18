import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
const app=resolve(import.meta.dirname,'../apps/mcp_bridge');
const auth='test-user-auth-token-long-enough';
const key='test-app-internal-token-long-enough';
const ext='test-remote-mcp-token-long-enough';
const open=async(fn)=>new Promise(ok=>{const s=http.createServer(fn);s.listen(0,'127.0.0.1',()=>ok(s));});
const addr=s=>'http://127.0.0.1:'+s.address().port;
const close=async s=>new Promise(ok=>s.close(ok));
const req=async(url,data,token=ext)=>{
 const r=await fetch(url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify(data)});
 return {status:r.status,payload:await r.json()};
};
const rpc=(id,method,params)=>({jsonrpc:'2.0',id,method,params});
const fakeCore=(label,actions)=>async(q,r)=>{
 const out=(code,data)=>{r.writeHead(code,{'Content-Type':'application/json'});r.end(JSON.stringify(data));};
 if(q.headers.authorization!=='Bearer '+auth)return out(401,{error:'unauthorized'});
 if(q.method==='GET'&&q.url==='/api/graph')return out(200,{version:1,nodes:actions.map(id=>({id,type:'action'})),edges:[]});
 if(q.method==='POST'&&q.url==='/api/invoke'){
  let raw='';for await (const c of q)raw+=c;const d=JSON.parse(raw);
  if(!actions.includes(d.action))return out(403,{error:'missing_action'});
  return out(200,{result:{node:label,action:d.action,params:d.params}});
 }
 out(404,{error:'not_found'});
};
const run=(env)=>spawn(process.execPath,[join(app,'service.mjs')],{env:{...process.env,...env},stdio:'pipe'});
async function untilReady(url,child){for(let i=0;i<100;i++){
 try{const r=await fetch(url+'/health');if(r.ok)return;}catch{}
 if(child.exitCode!==null)throw Error('bridge_exit: '+child.exitCode);
 await new Promise(r=>setTimeout(r,20));}throw Error('startup_timeout');}
const manifest=(await import('node:fs/promises')).readFile;
test('MAS app manifest has strict independent Core+App contract',async()=>{
 const m=JSON.parse(await manifest(join(app,'manifest.json'),'utf8'));
 assert.equal(m.mas,'1.0');assert.equal(m.lifecycle,'independent');assert.equal(m.auth.mode,'host-delegated');
 assert.equal(m.ui.standard,'mas-ui-1');assert.deepEqual(m.permissions,['mcp_bridge.read']);
 for(const file of ['service.mjs','config.mjs','network.mjs','protocol.mjs']){
  const raw=await manifest(join(app,file));assert(raw.length<=6144);assert(raw.toString().split('\n').length<=120);
 }
});
test('MCP discovers two nodes, enforces policy, hot reloads registry, uses no ChatGPT version',async t=>{
 const a=await open(fakeCore('nodeA',['browser.tabs','browser.click']));
 const b=await open(fakeCore('nodeB',['cms.health','browser.tabs']));
 const bridgePort=await open(()=>{});const port=bridgePort.address().port;await close(bridgePort);
 const dir=await mkdtemp(join(tmpdir(),'ada-mcp-test-')),path=join(dir,'registry.json');
 const cfg={schema:'adamantium.bridge.nodes.v1',nodes:[
  {id:'node_a',approved:true,urls:[addr(a)+'/'],tokenEnv:'ADA_TOKEN',allow:['browser.tabs']},
  {id:'node_b',approved:true,urls:[addr(b)+'/'],tokenEnv:'ADA_TOKEN',allow:['cms.health']} ]};
 await writeFile(path,JSON.stringify(cfg));
 const child=run({APP_PORT:String(port),ADA_INTERNAL_KEY:key,ADA_MCP_BEARER:ext,ADA_BRIDGE_CONFIG:path,ADA_TOKEN:auth});
 const url='http://127.0.0.1:'+port;
 t.after(async()=>{child.kill();await Promise.allSettled([close(a),close(b)]);await rm(dir,{recursive:true,force:true});});
 await untilReady(url,child);
 const unauthorized=await req(url,rpc(1,'tools/list'), 'wrong');assert.equal(unauthorized.status,401);
 const init=await req(url,rpc(2,'initialize',{protocolVersion:'2025-03-26',clientInfo:{name:'any-model',version:'0'}}));
 assert.equal(init.payload.result.serverInfo.name,'adamantium-mcp-bridge');
 const listed=await req(url,rpc(3,'tools/list'));assert.deepEqual(listed.payload.result.tools.map(x=>x.name),['adamantium_nodes','adamantium_capabilities','adamantium_invoke']);
 const nodeRes=await req(url,rpc(4,'tools/call',{name:'adamantium_nodes',arguments:{}}));
 const nodes=JSON.parse(nodeRes.payload.result.content[0].text);assert.equal(nodes.length,2);assert(nodes.every(x=>x.status==='reachable'));
 const denied=await req(url,rpc(5,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_a',action:'browser.click',params:{x:1}}}));
 assert.equal(denied.payload.result.isError,true);assert.match(denied.payload.result.content[0].text,/action_not_approved/);
 const allowed=await req(url,rpc(6,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_a',action:'browser.tabs'}}));
 assert.equal(JSON.parse(allowed.payload.result.content[0].text).result.result.node,'nodeA');
 cfg.nodes[1].allow.push('browser.tabs');await writeFile(path,JSON.stringify(cfg));
 const changed=await req(url,rpc(7,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_b',action:'browser.tabs'}}));
 assert.equal(changed.payload.result.isError,false);
 const missing=await req(url,rpc(8,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_b',action:'editor.run'}}));
 assert.equal(missing.payload.result.isError,true);
 // Migration by registry update, no model-side URL change and no server restart.
 const c=await open(fakeCore('migratedB',['browser.tabs']));
 t.after(async()=>close(c));
 cfg.nodes[1].urls=[addr(c)+'/'];await writeFile(path,JSON.stringify(cfg));
 const migrated=await req(url,rpc(9,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_b',action:'browser.tabs'}}));
 assert.equal(JSON.parse(migrated.payload.result.content[0].text).result.result.node,'migratedB');
});
