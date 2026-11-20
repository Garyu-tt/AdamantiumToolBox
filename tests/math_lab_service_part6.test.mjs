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
