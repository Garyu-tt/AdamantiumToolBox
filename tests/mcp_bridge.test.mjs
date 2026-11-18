import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {app,auth,key,ext,createIdentity,open,close,addr,req,rpc,result,fakeCore,run,untilReady,pin} from './support/mcp_bridge_fixture.mjs';
test('MAS bridge passes source budget and Core+App independent manifest',async()=>{
 const m=JSON.parse(await readFile(join(app,'manifest.json'),'utf8'));
 assert.equal(m.mas,'1.0');assert.equal(m.lifecycle,'independent');assert.equal(m.auth.mode,'host-delegated');
 assert.equal(m.ui.standard,'mas-ui-1');assert.deepEqual(m.permissions,['mcp_bridge.read']);
 for(const file of ['service.mjs','config.mjs','network.mjs','protocol.mjs']){
  const raw=await readFile(join(app,file));assert(raw.length<=6144);assert(raw.toString().split('\n').length<=120);
 }
});
test('MCP pins identity, filters graph, enforces allowlist, hot reloads registry',async t=>{
 const identityA=createIdentity(),identityB=createIdentity();
 const a=await open(fakeCore('nodeA',['browser.tabs','browser.click'],identityA));
 const b=await open(fakeCore('nodeB',['cms.health','browser.tabs'],identityB));
 const reserve=await open(()=>{});const port=reserve.address().port;await close(reserve);
 const dir=await mkdtemp(join(tmpdir(),'ada-mcp-test-')),path=join(dir,'registry.json');
 const cfg={schema:'adamantium.bridge.nodes.v1',nodes:[
  {id:'node_a',approved:true,urls:[addr(a)+'/'],tokenEnv:'ADA_TOKEN',allow:['browser.tabs'],identity:pin(identityA)},
  {id:'node_b',approved:true,urls:[addr(b)+'/'],tokenEnv:'ADA_TOKEN',allow:['cms.health'],identity:pin(identityB)}]};
 await writeFile(path,JSON.stringify(cfg));
 const child=run({APP_PORT:String(port),ADA_INTERNAL_KEY:key,ADA_MCP_BEARER:ext,ADA_BRIDGE_CONFIG:path,ADA_TOKEN:auth});
 const url='http://127.0.0.1:'+port;
 t.after(async()=>{child.kill();await Promise.allSettled([close(a),close(b)]);await rm(dir,{recursive:true,force:true});});
 await untilReady(url,child);
 assert.equal((await req(url,rpc(1,'tools/list'),'wrong')).status,401);
 const init=await req(url,rpc(2,'initialize',{protocolVersion:'2025-03-26',clientInfo:{name:'any-model',version:'0'}}));
 assert.equal(init.payload.result.serverInfo.name,'adamantium-mcp-bridge');
 const listed=await req(url,rpc(3,'tools/list'));assert.deepEqual(listed.payload.result.tools.map(x=>x.name),['adamantium_nodes','adamantium_capabilities','adamantium_invoke']);
 const nodes=result(await req(url,rpc(4,'tools/call',{name:'adamantium_nodes',arguments:{}})));
 assert.equal(nodes.length,2);assert(nodes.every(x=>x.status==='reachable'&&x.identity==='verified'));
 assert.deepEqual(nodes[0].nodes.map(x=>x.id),['browser.tabs']);
 const denied=await req(url,rpc(5,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_a',action:'browser.click',params:{x:1}}}));
 assert.equal(denied.payload.result.isError,true);assert.match(denied.payload.result.content[0].text,/action_not_approved/);
 const allowed=await req(url,rpc(6,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_a',action:'browser.tabs'}}));
 assert.equal(result(allowed).result.result.node,'nodeA');
 cfg.nodes[1].allow.push('browser.tabs');await writeFile(path,JSON.stringify(cfg));
 const changed=await req(url,rpc(7,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'node_b',action:'browser.tabs'}}));
 assert.equal(changed.payload.result.isError,false);
});
