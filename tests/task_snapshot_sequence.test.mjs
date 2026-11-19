import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,chmod,readFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,verify} from 'node:crypto';
import {FileSequenceStore} from '../apps/task_snapshot/sequence_store.mjs';
import {TaskSnapshotPublisher} from '../apps/task_snapshot/publisher.mjs';

const identity={streamId:'taskpool.workorders.v1',issuerProviderId:'task_pool'};
async function tempDir(){
 const dir=await mkdtemp(join(tmpdir(),'ada-snap-seq-'));
 return {dir,store:new FileSequenceStore({directory:dir})};
}
test('bootstrap explicitly and recover increasing high-water mark on restart',async()=>{
 const {dir,store}=await tempDir();
 try{
  await assert.rejects(()=>store.reserve(identity),/ENOENT/);
  assert.equal((await store.initialize(identity)).sequence,0);
  assert.equal(await store.reserve(identity),1);
  assert.equal(await new FileSequenceStore({directory:dir}).reserve(identity),2);
  assert.equal((await store.inspect()).sequence,2);
  await assert.rejects(()=>store.initialize(identity),/already initialized/);
  assert.equal((await store.inspect()).sequence,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('32 sequential local reservations preserve monotonic epochs',async()=>{
 const {dir,store}=await tempDir();
 try{
  await store.initialize(identity);
  // The approved single-host publisher serializes reservations.
  const values=[];
  for(let i=0;i<32;i++)values.push(await store.reserve(identity));
  assert.deepEqual(values,Array.from({length:32},(_,i)=>i+1));
  assert.equal((await store.inspect()).sequence,32);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('actual concurrent reservations cannot produce repeated epochs',async()=>{
 const {dir,store}=await tempDir();
 try{
  await store.initialize(identity);
  const attempts=await Promise.allSettled(Array.from({length:32},()=>store.reserve(identity)));
  const success=attempts.filter(x=>x.status==='fulfilled').map(x=>x.value);
  const failed=attempts.filter(x=>x.status==='rejected');
  assert.ok(success.length>=1);
  assert.equal(new Set(success).size,success.length);
  assert.equal((await store.inspect()).sequence,success.length);
  for(const failure of failed)assert.match(String(failure.reason),/operator must inspect/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('crash-held lock fails closed; no automatic stale-lock removal',async()=>{
 const {dir,store}=await tempDir();
 try{
  await store.initialize(identity);
  await writeFile(join(dir,'high-water.lock'),'abandoned\n',{mode:0o600});
  await assert.rejects(()=>store.reserve(identity),/operator must inspect/);
  assert.equal((await store.inspect()).sequence,0);
  // Simulation-only cleanup in disposable test directory; production
  // lock recovery MUST require an explicit operator reconciliation.
  await unlink(join(dir,'high-water.lock'));
  assert.equal(await store.reserve(identity),1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('missing or malformed persisted state never resets counter',async()=>{
 const {dir,store}=await tempDir();
 try{
  await store.initialize(identity);
  await store.reserve(identity);
  await writeFile(join(dir,'high-water.json'),'{broken',{mode:0o600});
  await assert.rejects(()=>store.reserve(identity));
  await writeFile(join(dir,'high-water.json'),JSON.stringify({
   schema:'mechanicus.snapshot-sequence/1',streamId:identity.streamId,
   issuerProviderId:identity.issuerProviderId,sequence:-1
  }),{mode:0o600});
  await assert.rejects(()=>store.reserve(identity),/corrupted/);
  await unlink(join(dir,'high-water.json'));
  await assert.rejects(()=>store.reserve(identity),/ENOENT/);
  // Operator must reconcile, NOT call initialize as a silent recovery path.
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('identity and mode mismatches stop read and signing',async()=>{
 const {dir,store}=await tempDir();
 try{
  await store.initialize(identity);
  await assert.rejects(()=>store.reserve({...identity,issuerProviderId:'other_provider'}),/identity mismatch/);
  assert.equal((await store.inspect()).sequence,0);
  await chmod(join(dir,'high-water.json'),0o644);
  await assert.rejects(()=>store.reserve(identity),/unsafe state file/);
  await chmod(join(dir,'high-water.json'),0o600);
  await chmod(dir,0o755);
  await assert.rejects(()=>store.reserve(identity),/unsafe directory/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('fresh publisher with restarted durable allocator signs strictly increasing epochs',async()=>{
 const {dir,store}=await tempDir();
 try{
  await store.initialize(identity);
  const key=generateKeyPairSync('ed25519');
  const view={nodes:[
   {id:'task_pool.list',type:'action'},
   {id:'task_pool.index',type:'resource',
    provider:{schema:'mas-task-provider-1',listAction:'task_pool.list'}}
  ]};
  const row={taskId:'00000000-0000-4000-8000-000000000001',title:'Task',
   status:'queued',revision:1,requires:[],lease:null};
  const instantiate=allocator=>new TaskSnapshotPublisher({
   signingKey:key.privateKey,keyId:'taskpool.signer.v1',streamId:identity.streamId,
   expectedTaskOwner:identity.issuerProviderId,
   reserveSequence:params=>allocator.reserve(params)
  });
  const input={visibleCoreGraph:view,readAction:async()=>[row],
   now:Date.parse('2026-11-20T00:00:00Z')};
  const first=await instantiate(store).publish(input);
  const second=await instantiate(new FileSequenceStore({directory:dir})).publish(input);
  assert.equal(first.sequence,1);
  assert.equal(second.sequence,2);
  const sig=Buffer.from(second.envelope.signatureBase64,'base64');
  const signed=Buffer.from(second.envelope.payloadBase64,'base64');
  assert.equal(verify(null,signed,key.publicKey,sig),true);
  assert.equal(JSON.parse(signed.toString()).revision,2);
  assert.equal((await store.inspect()).sequence,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
