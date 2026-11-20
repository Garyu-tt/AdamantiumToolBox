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


