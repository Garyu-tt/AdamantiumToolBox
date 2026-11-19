import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateFunction,prepareInvocation} from '../apps/forge/contract.mjs';
import {validateManifest,validateGraph} from '../core/contract.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const path=resolve(root,'apps/forge');
const fixture=JSON.parse(await readFile(resolve(path,'example.function.json'),'utf8'));
const manifest=JSON.parse(await readFile(resolve(path,'manifest.json'),'utf8'));
const protocol=JSON.parse(await readFile(resolve(path,'protocol.json'),'utf8'));
assert(validateManifest(manifest));
assert.equal(protocol.stores_state,false);
assert.equal(protocol.external_effects,false);
assert.equal(validateFunction(fixture).ok,true);
const bad={...fixture,request:{atomic:false,goal:'',acceptance:[]},dependencies:[
 {capability:fixture.capability.action}]};
const errors=validateFunction(bad);
assert.equal(errors.ok,false);
assert(errors.errors.some(e=>e.code==='NOT_ATOMIC'));
assert(errors.errors.some(e=>e.code==='DEPENDENCY_CONFLICT'));
assert(errors.errors.every(e=>e.reason&&e.impact&&e.evidence&&e.remedies.length));
assert.equal(validateFunction(null).ok,false);
assert.equal(prepareInvocation({function:fixture,request_id:'req-123456',arguments:{x:1}}).ok,true);
assert.equal(prepareInvocation({function:fixture,request_id:'x',arguments:{}}).ok,false);
assert.equal(prepareInvocation({function:fixture,request_id:'req-123456',arguments:[]}).ok,false);
const free=()=>new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>done(port));});});
const port=await free(),secret='forge-isolated-test-internal-key-012345';
const child=spawn(process.execPath,[resolve(path,'service.mjs')],{env:{...process.env,
 ADA_INTERNAL_KEY:secret,ADA_CAPS:manifest.permissions.join(','),APP_PORT:String(port)},stdio:'ignore'});
const url='http://127.0.0.1:'+port;
const query=async(route,body,auth=true)=>fetch(url+route,{method:body?'POST':'GET',
 headers:{...(auth?{'x-internal-key':secret}:{}),'Content-Type':'application/json'},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(1000)});
try{
 let ready=false;
 for(let i=0;i<50;i++){
  try{const r=await query('/health');if(r.ok){ready=true;break;}}catch{}
  if(child.exitCode!==null)throw Error('forge_service_failed');
  await new Promise(done=>setTimeout(done,60));
 }
 assert(ready,'health_timeout');
 assert.equal((await query('/graph',undefined,false)).status,401);
 const graph=await (await query('/graph')).json();
 assert(validateGraph(graph,manifest));
 assert(graph.nodes.some(n=>n.id==='forge.view'));
 assert(graph.nodes.every(n=>n.id.startsWith('forge.')));
 const described=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(described.result.schema,protocol.schema);
 const checked=await (await query('/invoke',{action:'forge.validate',params:{function:bad}})).json();
 assert.equal(checked.result.ok,false);
 const prepared=await (await query('/invoke',{action:'forge.prepare',params:{
  function:fixture,request_id:'req-123456',arguments:{function_id:'foo.bar'}}})).json();
 assert.equal(prepared.result.executed,false);
 assert.equal(prepared.result.provider_bound,false);
 assert.equal(prepared.result.envelope.validation_level,'structural-only');
 assert.equal((await query('/invoke',{action:'forge.destroy'})).status,404);
 console.log('FORGE_ADAPTER_TEST_OK: schema, safety, health, auth, graph, read, validate, envelope');
}finally{child.kill();}
