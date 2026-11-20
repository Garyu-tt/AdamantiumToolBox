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
test('R02 graph search uses dedicated experiment grant and returns no encoded private payload by default',async()=>{
 await withLab('math_lab.experiment',async({call,readGraph})=>{
  const graph=(await readGraph()).body;
  assert.ok(graph.nodes.some(x=>x.id==='math_lab.search'));
  assert.equal(graph.nodes.some(x=>x.id==='math_lab.reproduce'),false);
  const source=Buffer.from('1'+'0'.repeat(650));
  const reply=await call('math_lab.search',{
   datasetId:'test.graph',inputHex:source.toString('hex'),
   maxDepth:1,maxStates:9,maxRootCalls:2,maxRootEvaluations:4
  });
  assert.equal(reply.status,200);
  assert.equal(reply.body.result.report.originalBytes,source.length);
  assert.equal(reply.body.result.report.archiveApproved,false);
  assert.equal(reply.body.result.encodedHex,null);
  assert.equal(reply.body.result.independentAgentReviewed,false);
  assert.equal(reply.body.result.independentQACompleted,false);
  const denied=await call('math_lab.reproduce',{originalHex:'010203',encodedHex:'deadbeef'});
  assert.equal(denied.status,400);
  assert.equal(denied.body.error,'capability_denied');
  const malformed=await call('math_lab.search',{inputHex:'abcd',execute:"function(){return process.env;}"});
  assert.equal(malformed.status,400);
  assert.match(malformed.body.error,/unexpected_search_field/);
 });
});

