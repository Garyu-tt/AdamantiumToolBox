import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {auth,key,ext,createIdentity,open,close,addr,req,rpc,result,fakeCore,run,untilReady,pin} from './support/mcp_bridge_fixture.mjs';
const probe='probe-key-long-and-separate-from-mcp';
async function port(){const holder=await open(()=>{});const value=holder.address().port;await close(holder);return value;}
async function ready(url,secret=probe){
 const response=await fetch(url+'/ready',{headers:{'X-Adamantium-Probe':secret}});
 return {status:response.status,body:await response.json()};
}
async function terminate(child){if(child.exitCode!==null||child.signalCode!==null)return;const done=once(child,'exit');child.kill();await done;}
test('two independent ingress replicas survive one gateway loss; standby remains read-only',async t=>{
 const owner=createIdentity(),wrong=createIdentity();
 const primary=await open(fakeCore('primary',['browser.tabs'],owner));
 const standby=await open(fakeCore('standby',['browser.tabs'],owner));
 const impostor=await open(fakeCore('impostor',['browser.tabs'],wrong));
 const [aPort,bPort]=await Promise.all([port(),port()]);
 const dir=await mkdtemp(join(tmpdir(),'ada-mcp-ingress-')),file=join(dir,'registry.json');
 const cfg={schema:'adamantium.bridge.nodes.v1',nodes:[{id:'logical',approved:true,
  urls:[addr(primary)+'/',addr(standby)+'/'],tokenEnv:'ADA_TOKEN',allow:['browser.tabs'],identity:pin(owner)}]};
 await writeFile(file,JSON.stringify(cfg));
 const env={ADA_INTERNAL_KEY:key,ADA_MCP_BEARER:ext,ADA_MCP_PROBE_TOKEN:probe,ADA_BRIDGE_CONFIG:file,ADA_TOKEN:auth};
 const first=run({...env,APP_PORT:String(aPort)}),second=run({...env,APP_PORT:String(bPort)});
 const a='http://127.0.0.1:'+aPort,b='http://127.0.0.1:'+bPort;
 t.after(async()=>{await Promise.allSettled([terminate(first),terminate(second)]);
  await Promise.allSettled([close(primary),close(standby),close(impostor)]);await rm(dir,{recursive:true,force:true});});
 await Promise.all([untilReady(a,first),untilReady(b,second)]);
 assert.equal((await ready(a,'invalid')).status,401);
 const r1=await ready(a),r2=await ready(b);
 assert.equal(r1.status,200);assert.equal(r2.status,200);
 assert.equal(r1.body.mode,'write_ready');assert.equal(r1.body.primary,1);
 assert.equal(r1.body.policySha256,r2.body.policySha256);
 assert.match(r1.body.policySha256,/^[0-9a-f]{64}$/);
 assert(!JSON.stringify(r1.body).includes(auth),'probe response leaked a credential');
 await terminate(first);
 const surviving=await ready(b);assert.equal(surviving.status,200);
 assert.equal(result(await req(b,rpc(1,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'logical',action:'browser.tabs'}}))).result.result.node,'primary');
 cfg.nodes[0].urls=[addr(impostor)+'/',addr(standby)+'/'];await writeFile(file,JSON.stringify(cfg));
 const degraded=await ready(b);assert.equal(degraded.status,200);
 assert.equal(degraded.body.mode,'read_only');assert.equal(degraded.body.primary,0);
 assert.equal(degraded.body.standby,1);
 assert.notEqual(degraded.body.policySha256,r1.body.policySha256);
 const nodes=result(await req(b,rpc(2,'tools/call',{name:'adamantium_nodes',arguments:{}})));
 assert.equal(nodes[0].status,'read_only_standby');assert.equal(nodes[0].canInvoke,false);
 assert(nodes[0].nodes.every(x=>x.type!=='action'));
 const denied=await req(b,rpc(3,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'logical',action:'browser.tabs'}}));
 assert.equal(denied.payload.result.isError,true);
 cfg.nodes[0].urls=[addr(standby)+'/',addr(impostor)+'/'];await writeFile(file,JSON.stringify(cfg));
 assert.equal((await ready(b)).body.mode,'write_ready');
 assert.equal(result(await req(b,rpc(4,'tools/call',{name:'adamantium_invoke',arguments:{node_id:'logical',action:'browser.tabs'}}))).result.result.node,'standby');
 cfg.nodes[0].identity=undefined;await writeFile(file,JSON.stringify(cfg));
 assert.equal((await ready(b)).status,503);
 assert.equal((await ready(b)).body.mode,'unavailable');
});
