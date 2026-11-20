import test from 'node:test';
import assert from 'node:assert/strict';
import {VerifiedTaskSnapshotBridge} from '../apps/task_snapshot/core_read_bridge.mjs';

test('R08 holds the single-session lease until close has settled', async()=>{
 const now=Date.parse('2026-11-20T01:00:00Z');
 const expectedCore={nodeId:'core.primary',peerFingerprint:'a'.repeat(64),policySha256:'b'.repeat(64)};
 let releaseClose,closeStarted;
 const closing=new Promise(resolve=>{releaseClose=resolve;});
 const entered=new Promise(resolve=>{closeStarted=resolve;});
 let created=0;
 const bridge=new VerifiedTaskSnapshotBridge({
  expectedCore,expectedTaskOwner:'task_pool',
  publisher:{publish:async()=>({status:'source-not-visible',sequence:null,envelope:null})},
  createSession:async()=>{
   created++;
   return {
    attest:async()=>({...expectedCore,authenticated:true,identityVerified:true,
      status:'reachable',canInvoke:true,verifiedAt:now}),
    readGraph:async()=>({version:1,nodes:[],edges:[]}),
    invokeRead:async()=>{throw Error('unexpected invoke');},
    close:async()=>{closeStarted();await closing;}
   };
  }
 });
 const first=bridge.publish({now});
 await entered;
 try{
  await assert.rejects(()=>bridge.publish({now}),/concurrent snapshots/);
  assert.equal(created,1,'must not create second session while first close is pending');
 }finally{releaseClose();await first;}
});
