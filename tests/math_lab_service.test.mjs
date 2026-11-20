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
test('MAS graph exposes only permitted read-only catalog and denies compute without grant',async()=>{
 await withLab('math_lab.read',async({base,readGraph,call})=>{
  const health=await fetch(base+'/health');
  assert.equal(health.status,200);
  assert.equal((await readGraph(null)).status,401);
  const graph=await readGraph();
  assert.equal(graph.status,200);
  assert.equal(validateGraph(graph.body,manifest),true);
  assert.ok(graph.body.nodes.some(n=>n.id==='math_lab.view'));
  assert.ok(graph.body.nodes.some(n=>n.id==='math_lab.catalog'));
  assert.equal(graph.body.nodes.some(n=>n.id==='math_lab.experiment'),false);
  const catalog=await call('math_lab.catalog');
  assert.equal(catalog.status,200);
  assert.ok(catalog.body.result.disciplines.includes('number-theory'));
  assert.equal(catalog.body.result.agentsRunning,0);
  const plan=await call('math_lab.plan',{
   schema:'mechanicus.math-hypothesis/1',
   id:'root001',title:'Exact perfect-power experiments',
   target:'compression',discipline:'number-theory',
   method:'root-transform',datasetId:'demo001',
   claim:'Find and verify reversible compressed representations',
   sourceRefs:[]
  });
  assert.equal(plan.status,200);
  assert.equal(plan.body.result.nodes.length,8);
  assert.equal(plan.body.result.proposedOnly,true);
  assert.equal(plan.body.result.taskPoolSubmissionAuthorized,false);
  assert.equal(plan.body.result.archiveAuthorized,false);

  const forbidden=await call('math_lab.experiment',{inputHex:'01'});
  assert.equal(forbidden.status,400);
  assert.equal(forbidden.body.error,'capability_denied');
  assert.equal((await call('math_lab.catalog',{},'wrong')).status,401);
 });
});
