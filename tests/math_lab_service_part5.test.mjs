import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as pause} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {validateGraph} from '../core/contract.mjs';
import {readFile} from 'node:fs/promises';

const entry=fileURLToPath(new URL('../apps/math_lab/service.mjs',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../apps/math_lab/manifest.json',import.meta.url),'utf8'));
const secret='math-lab-only-experimental-internal-key-for-tests';
async function freePort(){
 const net=createServer();
 await new Promise((ok,bad)=>net.once('error',bad).listen(0,'127.0.0.1',ok));
 const port=net.address().port;
 await new Promise(ok=>net.close(ok));
 return port;
}
async function withLab(caps,run){
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[entry],{
  env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret,ADA_CAPS:caps},
  stdio:['ignore','pipe','pipe']
 });
 let stderr='';
 child.stderr.on('data',b=>{stderr+=b.toString();});
 try{
  let ready=false;
  for(let i=0;i<75;i++){
   if(child.exitCode!==null)throw Error('Math Lab exited: '+stderr);
   try{
    const response=await fetch(base+'/health',{signal:AbortSignal.timeout(700)});
    if(response.ok){ready=true;break;}
   }catch{}
   await pause(35);
  }
  if(!ready)throw Error('Math Lab startup timeout '+stderr);
  const call=async(action,params={},key=secret)=>{
   const r=await fetch(base+'/invoke',{method:'POST',headers:{
    'x-internal-key':key,'content-type':'application/json'
   },body:JSON.stringify({action,params})});
   return {status:r.status,body:await r.json()};
  };
  const readGraph=async(key=secret)=>{
   const r=await fetch(base+'/graph',{headers:key?{'x-internal-key':key}:{}});
   return {status:r.status,body:await r.json()};
  };
  await run({base,call,readGraph});
 }finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(ok=>child.once('exit',ok)),pause(2000)]);
  if(child.exitCode===null)child.kill('SIGKILL');
 }
}
test('R03 operation catalog and typed encode/decode DAGs require only read permission',async()=>{
 await withLab('math_lab.read',async({readGraph,call})=>{
  const graph=(await readGraph()).body;
  assert.ok(graph.nodes.some(x=>x.id==='math_lab.operations'));
  assert.ok(graph.nodes.some(x=>x.id==='math_lab.graph'));
  assert.ok(!graph.nodes.some(x=>x.id==='math_lab.encode'));
  const result=await call('math_lab.operations');
  assert.equal(result.status,200);
  assert.equal(result.body.result.abi,'mechanicus.math-operation-registry/1');
  assert.equal(result.body.result.operations.length,14);
  assert.ok(!result.body.result.dynamicExecutablePluginsAllowed);
  const pair=await call('math_lab.graph',{operationIds:[0x0101,0x0103],codecId:0x0201});
  assert.equal(pair.status,200);
  assert.deepEqual(pair.body.result.encode.nodes.filter(x=>x.operationId!==null).map(x=>x.operationId),
   [0x0101,0x0103,0x0201]);
  assert.deepEqual(pair.body.result.decode.nodes.filter(x=>x.operationId!==null).map(x=>x.operationId),
   [0x8201,0x8103,0x8101]);
  assert.equal((await call('math_lab.encode',{inputHex:'00',operationIds:[],codecId:0x0201})).body.error,
   'capability_denied');
  assert.equal((await call('math_lab.decode',{encodedHex:'deadbeef'})).body.error,
   'capability_denied');
 });
});

