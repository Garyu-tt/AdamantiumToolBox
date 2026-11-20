import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TaskPool} from '../apps/task_pool/store.mjs';
import {FileSequenceStore} from '../apps/task_snapshot/sequence_store.mjs';
import {TaskSnapshotPublisher} from '../apps/task_snapshot/publisher.mjs';
import {VerifiedTaskSnapshotBridge,assertCoreReadAttestation}
 from '../apps/task_snapshot/core_read_bridge.mjs';

const now=Date.parse('2026-11-20T00:30:00.000Z');
const expected={
 nodeId:'core.primary',peerFingerprint:'a'.repeat(64),
 policySha256:'b'.repeat(64)
};
const graph=()=>({version:1,nodes:[
 {id:'task_pool.view',type:'view'},
 {id:'task_pool.list',type:'action'},
 {id:'task_pool.index',type:'resource',provider:{
   schema:'mas-task-provider-1',listAction:'task_pool.list',getAction:'task_pool.get'}},
 {id:'task_pool.claim',type:'action'}
],edges:[]});
const attested=(fields={})=>({
 ...expected,authenticated:true,identityVerified:true,
 status:'reachable',canInvoke:true,verifiedAt:now-1000,...fields
});
const data=()=>[{
 taskId:'00000000-0000-4000-8000-000000000001',
 title:'Real Task Pool read',revision:2,status:'completed',requires:[],lease:null,
 outcome:{private:'do not leak to UI'}
}];
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'ada-r08-'));
 const file=new FileSequenceStore({directory:dir});
 await file.initialize({streamId:'taskpool.tasks.v1',issuerProviderId:'task_pool'});
 const keys=generateKeyPairSync('ed25519');
 const publisher=new TaskSnapshotPublisher({
  signingKey:keys.privateKey,keyId:'issuer.r08',streamId:'taskpool.tasks.v1',
  expectedTaskOwner:'task_pool',reserveSequence:p=>file.reserve(p)
 });
 const calls=[],session={
  attest:async()=>{calls.push('attest');return attested();},
  readGraph:async()=>{calls.push('graph');return graph();},
  invokeRead:async(action,params)=>{
   calls.push(action);assert.deepEqual(params,{limit:200});
   return {result:data()};
  },
  close:async()=>{calls.push('close');}
 };
 const bridge=new VerifiedTaskSnapshotBridge({
  createSession:async()=>session,publisher,
  expectedCore:expected,expectedTaskOwner:'task_pool'
 });
 return {dir,file,keys,publisher,session,bridge,calls};
}
test('fresh independently pinned MAS Core attestation is accepted',()=>{
 const result=assertCoreReadAttestation(attested(),expected,{now});
 assert.equal(result.readAuthorized,true);
 assert.equal(result.nodeId,'core.primary');
});
test('rejects missing crypto proof, peer mismatch, wrong policy, standby and stale identity',()=>{
 for(const bad of [
  {authenticated:false},{identityVerified:false},{nodeId:'core.other'},
  {peerFingerprint:'c'.repeat(64)},{policySha256:'c'.repeat(64)},
  {status:'read_only_standby'},{status:'offline'},
  {canInvoke:false},{verifiedAt:now-60000},{verifiedAt:now+60000}
 ]){
  assert.throws(()=>assertCoreReadAttestation(attested(bad),expected,{now}),/R08 trusted Core read/);
 }
});
test('binds approved Core read to R07 signature and strips private Task Pool data',async()=>{
 const f=await fixture();
 try{
  const result=await f.bridge.publish({now});
  assert.equal(result.signed,true);
  assert.equal(result.status,'signed-read-only');
  assert.equal(result.nodeId,'core.primary');
  assert.equal(result.sequence,1);
  assert.deepEqual(f.calls,['attest','graph','attest','task_pool.list','attest','close']);
  const bytes=Buffer.from(result.envelope.payloadBase64,'base64');
  assert.equal(verify(null,bytes,f.keys.publicKey,
   Buffer.from(result.envelope.signatureBase64,'base64')),true);
  const payload=JSON.parse(bytes.toString('utf8'));
  assert.equal(payload.snapshot.tasks[0].status,'completed-unverified');
  assert.ok(!bytes.toString().includes('do not leak'));
  assert.equal(result.authorizedExecution,false);
  assert.equal(result.graphMutationAuthorized,false);
  assert.equal((await f.file.inspect()).sequence,1);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('graph without task_pool.list cannot invoke or sign a fake empty queue',async()=>{
 const f=await fixture();
 try{
  f.session.readGraph=async()=>({version:1,nodes:graph().nodes.filter(n=>n.id!=='task_pool.list'),edges:[]});
  f.session.invokeRead=async()=>{throw Error('must not be invoked');};
  const result=await f.bridge.publish({now});
  assert.equal(result.status,'source-not-visible');
  assert.equal(result.signed,false);
  assert.equal((await f.file.inspect()).sequence,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('Core authorization denial is not rebranded as an empty Task Pool queue',async()=>{
 const f=await fixture();
 try{
  f.session.invokeRead=async()=>{throw Error('Core: unauthorized');};
  const result=await f.bridge.publish({now});
  assert.equal(result.status,'source-read-failed');
  assert.equal(result.envelope,null);
  assert.equal((await f.file.inspect()).sequence,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('wrong Core response envelope cannot be signed',async()=>{
 const f=await fixture();
 try{
  f.session.invokeRead=async()=>({status:200,body:data()});
  const result=await f.bridge.publish({now});
  assert.equal(result.status,'source-read-failed');
  assert.equal((await f.file.inspect()).sequence,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('untrusted peer identity is rejected before graph read and sequence allocation',async()=>{
 const f=await fixture();
 try{
  f.session.attest=async()=>attested({nodeId:'other'});
  await assert.rejects(()=>f.bridge.publish({now}),/identity or authorized policy mismatch/);
  assert.equal((await f.file.inspect()).sequence,0);
  assert.equal(f.calls.includes('graph'),false);
  assert.equal(f.calls.at(-1),'close');
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('peer identity can change between graph read and task invocation',async()=>{
 const f=await fixture();
 try{
  let count=0;
  f.session.attest=async()=>count++===0?attested():attested({status:'offline'});
  const result=await f.bridge.publish({now});
  assert.equal(result.status,'source-read-failed');
  assert.equal((await f.file.inspect()).sequence,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('identity revoked after task read but before signing rejects the snapshot',async()=>{
 const f=await fixture();
 try{
  let count=0;
  f.session.attest=async()=>count++<2?attested():attested({policySha256:'d'.repeat(64)});
  const result=await f.bridge.publish({now});
  assert.equal(result.status,'source-read-failed');
  assert.equal(result.envelope,null);
  assert.equal((await f.file.inspect()).sequence,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('unexpected graph and missing trusted session callbacks fail closed',async()=>{
 const f=await fixture();
 try{
  f.session.readGraph=async()=>({version:2,nodes:[],edges:[]});
  await assert.rejects(()=>f.bridge.publish({now}),/permission-filtered Core graph/);
  assert.equal((await f.file.inspect()).sequence,0);
  const broken=new VerifiedTaskSnapshotBridge({
   createSession:async()=>({attest:async()=>attested()}),publisher:f.publisher,
   expectedCore:expected,expectedTaskOwner:'task_pool'
  });
  await assert.rejects(()=>broken.publish({now}),/approved Core session interface/);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('single publisher rejects concurrent signing operations',async()=>{
 const f=await fixture();
 try{
  let release;
  f.session.readGraph=()=>new Promise(resolve=>{release=()=>resolve(graph());});
  const first=f.bridge.publish({now});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof release,'function');
  await assert.rejects(()=>f.bridge.publish({now}),/concurrent snapshots/);
  release();
  assert.equal((await first).sequence,1);
  assert.equal((await f.file.inspect()).sequence,1);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('real local Task Pool is reached only through the approved Core read callback',async()=>{
 const f=await fixture();
 const dir=await mkdtemp(join(tmpdir(),'ada-r08-pool-'));
 try{
  const pool=new TaskPool(dir,()=>now);
  await pool.startup();
  await pool.submit({title:'Real persistent task',requires:[],
   payload:{private:'hidden'}});
  f.session.invokeRead=async(action,params)=>{
   assert.equal(action,'task_pool.list');
   return {result:await pool.list(params)};
  };
  const signed=await f.bridge.publish({now});
  assert.equal(signed.signed,true);
  const payload=JSON.parse(Buffer.from(signed.envelope.payloadBase64,'base64'));
  assert.equal(payload.snapshot.tasks.length,1);
  assert.equal(payload.snapshot.tasks[0].status,'queued');
  assert.equal(JSON.stringify(payload).includes('hidden'),false);
  assert.equal((await f.file.inspect()).sequence,1);
 }finally{
  await rm(dir,{recursive:true,force:true});
  await rm(f.dir,{recursive:true,force:true});
 }
});
