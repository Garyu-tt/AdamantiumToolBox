/**
 * Opt-in cross-repo contract integration test.
 *
 * CI checks out an exact pinned commit of Garyu-tt/adamantium-node under
 * _interop/adamantium-node. This file is not part of the ordinary test glob.
 */
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {TaskSnapshotPublisher} from '../../apps/task_snapshot/publisher.mjs';
import {verifySnapshotEnvelope} from '../../_interop/adamantium-node/adamantium/orchestration-signed-snapshot.mjs';

const signer=generateKeyPairSync('ed25519');
let next=41;
const publisher=new TaskSnapshotPublisher({
 signingKey:signer.privateKey,keyId:'taskpool.publisher.v1',
 streamId:'taskpool.tasks.v1',expectedTaskOwner:'task_pool',
 reserveSequence:async()=>++next
});
const sourceGraph={nodes:[
 {id:'task_pool.list',type:'action'},
 {id:'task_pool.index',type:'resource',
  provider:{schema:'mas-task-provider-1',listAction:'task_pool.list'}}
]};
const sourceRows=[
 {taskId:'00000000-0000-4000-8000-000000000001',title:'Task one',
  status:'completed',revision:2,requires:[],lease:null,
  outcome:{result:'done but needs independent QA'}},
 {taskId:'00000000-0000-4000-8000-000000000002',title:'Task two',
  status:'needs_review',revision:3,requires:[],lease:null,
  note:'lease_expired_execution_unknown'}
];
const now=Date.parse('2026-11-20T00:05:00Z');
const result=await publisher.publish({
 visibleCoreGraph:sourceGraph,
 readAction:async(action,params)=>{
  assert.equal(action,'task_pool.list');
  assert.deepEqual(params,{limit:200});
  return sourceRows;
 },
 now
});
const verified=verifySnapshotEnvelope(result.envelope,{
 trustedKeys:new Map([['taskpool.publisher.v1',signer.publicKey]]),
 expectedAuthorityProviderId:'task_pool',now:now+1000
});
assert.equal(verified.sequence,42);
assert.equal(verified.view.taskCounts['completed-unverified'],1);
assert.equal(verified.view.taskCounts['needs-review'],1);
assert.equal(verified.projection.document.screens.length,2);
assert.equal(verified.invocationAuthorized,false);
assert.equal(verified.graphMutationAuthorized,false);
const decoded=Buffer.from(result.envelope.payloadBase64,'base64');
assert.equal(JSON.stringify(JSON.parse(decoded)),decoded.toString());
assert.equal(verified.digest,createHash('sha256').update(decoded).digest('hex'));
assert.equal(decoded.toString().includes('done but needs independent QA'),false);
console.log('R07_R05_INTEROP_OK signed Task Pool snapshot accepted by pinned Adamantium-node R05 validator');
