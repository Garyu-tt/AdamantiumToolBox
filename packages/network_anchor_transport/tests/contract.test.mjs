import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fixture as anchorFixture} from '../../network_anchor/tests/fixture.mjs';
import {ORIGIN,sha} from '../lib/anchor-contract.mjs';
import {witnessSnapshot,verifyRemoteState,verifyCommit} from '../lib/verify.mjs';
import {loadCache,saveCache,compareCache} from '../lib/cache.mjs';

test('standalone source verifies Witness receipt signatures and contiguous hash chain',{timeout:12000},async()=>{
 const f=await anchorFixture(),log=join(f.home,'witness.log');
 try{
  const a=f.next(),b=f.next(),rows=[a,b].map((r,i)=>({seq:i+1,
   previous:i===0?ORIGIN:a.witnessRevision,record:r.receipt,signature:r.signature,hash:r.witnessRevision}));
  await writeFile(log,rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{mode:0o600});
  const snap=await witnessSnapshot(log,f.trust);assert.equal(snap.seq,2);assert.equal(snap.head,b.witnessRevision);
  rows[1].signature='A'.repeat(88);await writeFile(log,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await assert.rejects(witnessSnapshot(log,f.trust),/untrusted_witness_receipt/);
  await writeFile(log,JSON.stringify(rows[0]));await assert.rejects(witnessSnapshot(log,f.trust),/truncated_witness_log/);
 }finally{await f.remove();}
});

test('Anchor proofs prevent fabricated nonempty history and malformed trust',{timeout:12000},async()=>{
 const f=await anchorFixture();try{
  const genesis={schema:'network-anchor-transport-state-v1',anchorId:f.trust.anchor.id,
   witnessId:f.trust.witness.id,revision:ORIGIN,count:0,witnessSeq:0,witnessHead:ORIGIN,latest:null};
  assert.equal(verifyRemoteState(genesis,f.trust).count,0);
  assert.throws(()=>verifyRemoteState({...genesis,count:1},f.trust),/invalid_anchor_proof/);
  assert.throws(()=>verifyRemoteState({...genesis,anchorId:'wrong'},f.trust),/invalid_anchor_state/);
  assert.throws(()=>verifyRemoteState({...genesis,revision:sha('fake')},f.trust),/invalid_anchor_genesis/);
 }finally{await f.remove();}
});

test('signed cache blocks remote rollback and conflicting equal-sequence history',{timeout:12000},async()=>{
 const f=await anchorFixture(),path=join(f.home,'cache.json');try{
  const genesis={schema:'network-anchor-transport-state-v1',anchorId:f.trust.anchor.id,
   witnessId:f.trust.witness.id,revision:ORIGIN,count:0,witnessSeq:0,witnessHead:ORIGIN,latest:null};
  await saveCache(path,genesis,f.trust);const saved=await loadCache(path,f.trust);
  compareCache(saved,genesis);assert.equal(saved.revision,ORIGIN);
  await writeFile(path,'{bad', {mode:0o600});await assert.rejects(loadCache(path,f.trust),/corrupt_cache/);
 }finally{await f.remove();}
});

test('commit attestation is bound to the exact requested batch and previous anchor head',async()=>{
 const f=await anchorFixture();
 try{
  const {signAttestation}=await import('../lib/anchor-contract.mjs');
  const entry=f.next(),batch=[entry],previous={revision:ORIGIN,count:0,witnessSeq:0,witnessHead:ORIGIN};
  const at=new Date().toISOString();
  function signed(candidate,prevHead=previous.revision){
   const head=sha(JSON.stringify({seq:1,previous:prevHead,batch:candidate,at}));
   const attestation={schema:'network-anchor-attestation-v1',anchorId:f.trust.anchor.id,
    witnessId:f.trust.witness.id,anchorSeq:1,anchorHead:head,
    witnessSeq:entry.receipt.anchorSeq,witnessHead:entry.witnessRevision,at};
   return {revision:head,attestation,
    signature:signAttestation(attestation,f.keys.anchor.privateKey),enforcement:false};
  }
  const valid=signed(batch);
  assert.equal(verifyCommit(valid,f.trust,entry,previous,batch).revision,valid.revision);
  const substituted=signed([{...entry,unrequestedPayload:true}]);
  assert.throws(()=>verifyCommit(substituted,f.trust,entry,previous,batch),/untrusted_anchor_commit/);
  const wrongPredecessor=signed(batch,sha('unrelated-anchor-predecessor'));
  assert.throws(()=>verifyCommit(wrongPredecessor,f.trust,entry,previous,batch),/untrusted_anchor_commit/);
  assert.throws(()=>verifyCommit(valid,f.trust,entry,previous,[]),/untrusted_anchor_commit/);
 }finally{await f.remove();}
});
