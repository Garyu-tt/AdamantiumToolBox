import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,verify,createHash} from 'node:crypto';
import {TaskPool} from '../apps/task_pool/store.mjs';
import {discoverTaskListAction,collectTaskSnapshot} from '../apps/task_snapshot/read_source.mjs';
import {TaskSnapshotPublisher} from '../apps/task_snapshot/publisher.mjs';

const keyPair=generateKeyPairSync('ed25519');
const owner='task_pool', when=Date.parse('2026-11-20T00:00:00Z');
const graph=()=>({version:1,nodes:[
 {id:'task_pool.view',type:'view'},
 {id:'task_pool.list',type:'action'},
 {id:'task_pool.get',type:'action'},
 {id:'task_pool.claim',type:'action'},
 {id:'task_pool.index',type:'resource',provider:{
  schema:'mas-task-provider-1',listAction:'task_pool.list',getAction:'task_pool.get'
 }}
],edges:[]});
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const task=(n,status,extras={})=>({
 taskId:uuid(n),title:'Task '+n,revision:1,requires:['system.inspect'],
 status,lease:status==='claimed'?{workerId:'worker.a',expiresAt:when+30000}:null,
 ...extras
});
const makePublisher=(reserveSequence,options={})=>new TaskSnapshotPublisher({
 signingKey:keyPair.privateKey,keyId:'taskpool.publisher.v1',
 streamId:'taskpool.tasks.v1',expectedTaskOwner:owner,reserveSequence,...options
});
const callInput=(readAction,visibleCoreGraph=graph())=>({
 visibleCoreGraph,readAction,now:when
});
const payloadOf=value=>JSON.parse(Buffer.from(value.envelope.payloadBase64,'base64').toString('utf8'));

test('source discovery binds resource to the exact permitted list action',()=>{
 assert.equal(discoverTaskListAction(graph(),{expectedOwner:owner}),'task_pool.list');
 const g=graph();g.nodes=g.nodes.filter(x=>x.id!=='task_pool.list');
 assert.equal(discoverTaskListAction(g,{expectedOwner:owner}),null);
 const forged=graph();forged.nodes[4].provider.listAction='task_pool.claim';
 assert.equal(discoverTaskListAction(forged,{expectedOwner:owner}),null);
 assert.equal(discoverTaskListAction(graph(),{expectedOwner:'another_owner'}),null);
});
test('missing source cannot be reported as an empty task list, and reads nothing',async()=>{
 let called=0,reserved=0;
 const p=makePublisher(async()=>++reserved);
 const response=await p.publish(callInput(async()=>{called++;return[];},{nodes:[]}));
 assert.equal(response.status,'source-not-visible');
 assert.equal(response.envelope,null);
 assert.equal(called,0);
 assert.equal(reserved,0);
});
test('unavailable read neither signs data nor reserves a sequence',async()=>{
 let reserved=0;
 const p=makePublisher(async()=>++reserved);
 const response=await p.publish(callInput(async()=>{throw Error('Core denied');}));
 assert.equal(response.status,'source-read-failed');
 assert.equal(response.envelope,null);
 assert.equal(reserved,0);
});
test('valid signed envelope matches R05 exact wire format and does not grant execution',async()=>{
 let seq=10;
 const p=makePublisher(async()=>++seq);
 const readAction=async(id,params)=>{
  assert.equal(id,'task_pool.list');
  assert.deepEqual(params,{limit:200});
  return [task(1,'queued'),task(2,'claimed'),task(3,'needs_review',{
   note:'lease_expired_unknown',outcome:{private:'secret'}}),task(4,'completed',{
   outcome:{result:'not independently reviewed'},lease:null})];
 };
 const data=await p.publish(callInput(readAction));
 assert.equal(data.status,'signed-read-only');
 assert.equal(data.authorizedExecution,false);
 assert.equal(data.graphMutationAuthorized,false);
 assert.equal(data.sequence,11);
 const buf=Buffer.from(data.envelope.payloadBase64,'base64');
 const signature=Buffer.from(data.envelope.signatureBase64,'base64');
 assert.equal(verify(null,buf,keyPair.publicKey,signature),true);
 assert.equal(data.digest,createHash('sha256').update(buf).digest('hex'));
 assert.equal(signature.length,64);
 const payload=payloadOf(data);
 assert.equal(payload.schema,'mechanicus.orchestration-signed-snapshot/1');
 assert.equal(payload.streamId,'taskpool.tasks.v1');
 assert.equal(payload.sequence,11);
 assert.equal(payload.revision,11);
 assert.equal(payload.issuerProviderId,owner);
 assert.equal(payload.snapshot.authorityProviderId,owner);
 assert.equal(payload.snapshot.revision,11);
 assert.equal(payload.expiresAt,'2026-11-20T00:02:00.000Z');
 assert.deepEqual(payload.snapshot.tasks.map(x=>x.status),
  ['queued','claimed','needs-review','completed-unverified']);
 assert.deepEqual(payload.snapshot.tasks[0].dependsOn,[]);
 assert.equal(payload.snapshot.tasks[3].evidenceRef,undefined);
 assert.equal(payload.snapshot.tasks[2].blockers[0].reason,'lease_expired_unknown');
 assert.equal(buf.includes(Buffer.from('secret')),false);
 assert.equal(buf.includes(Buffer.from('private')),false);
 assert.equal(buf.includes(Buffer.from('worker.a')),false);
});
test('signed snapshot rejects forged signature even if JSON is changed',async()=>{
 let seq=0;
 const data=await makePublisher(async()=>++seq).publish(callInput(async()=>[task(1,'queued')]));
 const payload=payloadOf(data);
 payload.snapshot.tasks[0].status='complete';
 const tampered=Buffer.from(JSON.stringify(payload));
 assert.equal(verify(null,tampered,keyPair.publicKey,
  Buffer.from(data.envelope.signatureBase64,'base64')),false);
});
test('malformed, ambiguous and oversized source data fails closed',async()=>{
 let count=0;
 const p=makePublisher(async()=>++count);
 const duplicate=graph();duplicate.nodes.push({...duplicate.nodes[4],id:'task_pool.other'});
 await assert.rejects(()=>p.publish(callInput(async()=>[],duplicate)),/ambiguous/);
 await assert.rejects(()=>p.publish(callInput(async()=>new Array(201).fill(null))),/bounded/);
 await assert.rejects(()=>p.publish(callInput(async()=>[task(1,'claimed',{lease:null})])),/claimed without lease/);
 await assert.rejects(()=>p.publish(callInput(async()=>[task(1,'queued'),task(1,'queued')])),/duplicate task/);
 assert.equal(count,0);
});
test('rejects missing signing credentials and invalid non-durable allocator',async()=>{
 assert.throws(()=>new TaskSnapshotPublisher({
  signingKey:keyPair.publicKey,keyId:'k',streamId:'stream',expectedTaskOwner:owner,
  reserveSequence:async()=>1}),/Ed25519/);
 assert.throws(()=>makePublisher(undefined),/allocator/);
 await assert.rejects(()=>makePublisher(async()=>0).publish(callInput(async()=>[])),/reserved sequence/);
});
test('real TaskPool data reads through the allowed list contract, preserving unverified finish',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'adamantium-r07-'));
 try{
  const pool=new TaskPool(dir,()=>when);
  await pool.startup();
  await pool.submit({title:'Review build',requires:[],payload:{private:'do not expose'}});
  const lease=await pool.claim({workerId:'worker.a',capabilities:[]});
  await pool.transition({taskId:lease.taskId,workerId:'worker.a',token:lease.token,
   result:{text:'finished but no QA'}},'completed');
  const approved=async(action,params)=>{
   assert.equal(action,'task_pool.list');
   return pool.list(params);
  };
  const value=await makePublisher(async()=>1).publish(callInput(approved));
  const payload=payloadOf(value);
  assert.equal(payload.snapshot.tasks.length,1);
  assert.equal(payload.snapshot.tasks[0].status,'completed-unverified');
  assert.equal(payload.snapshot.tasks[0].evidenceRef,undefined);
  assert.equal(JSON.stringify(payload).includes('do not expose'),false);
  assert.equal(JSON.stringify(payload).includes('finished but no QA'),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('sequential publisher epochs advance with trusted allocator',async()=>{
 let count=2;
 const p=makePublisher(async()=>++count);
 const one=await p.publish(callInput(async()=>[task(1,'queued')]));
 const two=await p.publish(callInput(async()=>[task(1,'queued')]));
 assert.equal(one.sequence,3);
 assert.equal(two.sequence,4);
 assert.notEqual(one.digest,two.digest);
});
