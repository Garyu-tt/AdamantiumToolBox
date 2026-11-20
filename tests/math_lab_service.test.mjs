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

test('R02 reference verifier has a separate permission and produces no original bytes',async()=>{
 await withLab('math_lab.verify',async({call,readGraph})=>{
  const g=(await readGraph()).body;
  assert.ok(g.nodes.some(x=>x.id==='math_lab.reproduce'));
  assert.equal(g.nodes.some(x=>x.id==='math_lab.search'),false);
  const original=Buffer.from([1,2,3,4,5]);
  const transposed=Buffer.from([1,3,5,2,4]);
  const {deflateSync}=await import('node:zlib');
  const frame=Buffer.concat([
   Buffer.from('MLG2','ascii'),Buffer.from([5,1,3,1]),
   deflateSync(transposed)
  ]);
  const out=await call('math_lab.reproduce',{
   datasetId:'verified.fixture',
   originalHex:original.toString('hex'),
   encodedHex:frame.toString('hex')
  });
  assert.equal(out.status,200);
  assert.equal(out.body.result.exactByteEquality,true);
  assert.equal(out.body.result.independentAgentReviewed,false);
  assert.equal(out.body.result.independentQACompleted,false);
  assert.equal(JSON.stringify(out.body).includes(original.toString('hex')),false);
  const corrupted=await call('math_lab.reproduce',{
   originalHex:'010203',encodedHex:frame.toString('hex')
  });
  assert.equal(corrupted.status,400);
  const refused=await call('math_lab.search',{inputHex:'010203'});
  assert.equal(refused.status,400);
  assert.equal(refused.body.error,'capability_denied');
 });
});


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

test('R03 encode/decode actions are permission separated and export bytes only with explicit opt-in',async()=>{
 let encoded;
 await withLab('math_lab.experiment',async({call})=>{
  const original=Buffer.from('abbaabbabaabb'.repeat(20));
  const params={
   inputHex:original.toString('hex'),operationIds:[0x0101,0x0103],codecId:0x0201
  };
  const noBytes=await call('math_lab.encode',params);
  assert.equal(noBytes.status,200,JSON.stringify(noBytes.body));
  assert.equal(noBytes.body.result.encodedHex,null);
  assert.equal(noBytes.body.result.graphs.decode.nodes.length,5);
  const exported=await call('math_lab.encode',{...params,includeEncoded:true});
  assert.equal(exported.status,200,JSON.stringify(exported.body));
  encoded=exported.body.result.encodedHex;
  assert.ok(encoded.startsWith(Buffer.from('MLG3').toString('hex')));
  assert.equal(exported.body.result.encodedSha256,noBytes.body.result.encodedSha256);
  assert.equal((await call('math_lab.decode',{encodedHex:encoded})).body.error,'capability_denied');
  const bad=await call('math_lab.encode',{...params,operationIds:[0xffff]});
  assert.equal(bad.status,400);
  const unknown=await call('math_lab.encode',{...params,executable:'require("fs")'});
  assert.match(unknown.body.error,/unexpected_operation_encode_field/);
 });
 await withLab('math_lab.verify',async({call})=>{
  const withoutBytes=await call('math_lab.decode',{encodedHex:encoded});
  assert.equal(withoutBytes.status,200,JSON.stringify(withoutBytes.body));
  assert.equal(withoutBytes.body.result.decodedHex,null);
  assert.equal(withoutBytes.body.result.checksumVerified,true);
  const withBytes=await call('math_lab.decode',{
   encodedHex:encoded,includeDecoded:true
  });
  assert.equal(withBytes.status,200);
  assert.deepEqual(Buffer.from(withBytes.body.result.decodedHex,'hex'),
   Buffer.from('abbaabbabaabb'.repeat(20)));
  const corrupted=Buffer.from(encoded,'hex');corrupted[5]^=1;
  const rejected=await call('math_lab.decode',{encodedHex:corrupted.toString('hex')});
  assert.equal(rejected.status,400);
  assert.equal((await call('math_lab.encode',{inputHex:'01',operationIds:[],codecId:0x0201})).body.error,
   'capability_denied');
 });
});
