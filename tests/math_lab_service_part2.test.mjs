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
test('approved bounded experiment returns exact MDL evidence, not source bytes',async()=>{
 await withLab('math_lab.read,math_lab.experiment',async({call,readGraph})=>{
  const graph=(await readGraph()).body;
  assert.equal(validateGraph(graph,manifest),true);
  assert.ok(graph.nodes.some(n=>n.id==='math_lab.experiment'));
  let hex=(10n**1000n).toString(16);
  if(hex.length%2)hex='0'+hex;
  const response=await call('math_lab.experiment',{
   datasetId:'api.demo',inputHex:hex,degrees:[1000],
   maxDepth:1,maxEvaluations:4,rootModelBytes:8
  });
  assert.equal(response.status,200);
  const v=response.body.result;
  assert.equal(v.originalBytes,416);
  assert.equal(v.selected,'root-transform');
  assert.ok(v.savingsBytes>300);
  assert.equal(v.verification.exactRootRoundtrip,true);
  assert.equal(v.verification.independentAudit,'not-performed');
  assert.equal(v.verification.approvedForProduction,false);
  assert.equal(JSON.stringify(v).includes(hex),false);
  assert.match(v.experimentDigest,/^[a-f0-9]{64}$/);
 });
});
test('service rejects oversized inputs, arbitrary scripting, and excessive degree budgets',async()=>{
 await withLab('math_lab.experiment',async({call})=>{
  let r=await call('math_lab.experiment',{inputHex:'ab'.repeat(2049)});
  assert.equal(r.status,400);
  assert.match(r.body.error,/invalid_input_hex/);
  r=await call('math_lab.experiment',{inputHex:'01',eval:'return process.env'});
  assert.equal(r.status,400);
  assert.match(r.body.error,/unexpected_experiment_field/);
  r=await call('math_lab.experiment',{inputHex:'01',degrees:[1]});
  assert.equal(r.status,400);
  r=await call('math_lab.catalog');
  assert.equal(r.status,400);
  assert.equal(r.body.error,'capability_denied');
 });
});


