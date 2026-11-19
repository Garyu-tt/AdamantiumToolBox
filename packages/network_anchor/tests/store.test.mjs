import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {fixture} from './fixture.mjs';
import {openAnchor} from '../lib/store.mjs';
import {verifyAttestation,ORIGIN} from '../lib/contract.mjs';
const start=f=>openAnchor({logPath:f.logPath,trustPath:f.trustPath,keyPath:f.keyPath});
test('persist independently signed anchor and verify witnessed history after restart',async()=>{
 const f=await fixture();let s;try{s=await start(f);const a=f.next(),out=await s.commit({batch:[a],expectedRevision:ORIGIN});
  assert.equal(s.witnessSeq,1);assert.equal(s.inspect(a).state,'matches_anchor');
  assert(verifyAttestation(out.attestation,out.signature,f.trust));
  assert(!JSON.stringify(s.latest()).includes('privateKey'));
  await s.close();s=null;s=await start(f);
  assert.equal(s.witnessSeq,1);assert.equal(s.head,out.revision);
  assert.equal(s.inspect(a).state,'matches_anchor');
  const older={...a,signature:'x'};assert.equal(s.inspect(older).state,'invalid_proof');
 }finally{await s?.close();await f.remove();}
});
test('CAS, contiguous witness chain and replay failures are denied',async()=>{
 const f=await fixture();let s;try{s=await start(f);const a=f.next(),b=f.next(),c=f.next();
  await assert.rejects(s.commit({batch:[b],expectedRevision:ORIGIN}),/invalid_witness_chain/);
  const one=await s.commit({batch:[a],expectedRevision:ORIGIN});
  await assert.rejects(s.commit({batch:[b],expectedRevision:ORIGIN}),/revision_conflict/);
  await assert.rejects(s.commit({batch:[a],expectedRevision:one.revision}),/invalid_witness_chain/);
  const two=await s.commit({batch:[b,c],expectedRevision:one.revision});
  assert.equal(s.witnessSeq,3);assert.equal(s.inspect(a).state,'older_than_anchor');
  assert.equal(s.inspect(c).state,'matches_anchor');
  assert(two.revision!==one.revision);
  await s.close();s=null;const original=await readFile(f.logPath,'utf8');
  await writeFile(f.logPath,original.slice(0,-2));
  await assert.rejects(start(f),/truncated_anchor_journal/);
  await writeFile(f.logPath,original.replace('approval','intruder'));
  await assert.rejects(start(f),/invalid_witness_chain|corrupt_anchor_journal/);
 }finally{await s?.close();await f.remove();}
});
test('multiple writers, world-readable identity and altered signature fail closed',async()=>{
 const f=await fixture();let s;try{s=await start(f);
  await assert.rejects(start(f),/anchor_already_locked/);
  await s.close();s=null;await chmod(f.keyPath,0o644);
  await assert.rejects(start(f),/unsafe_private_file/);
 }finally{await s?.close();await f.remove();}
});
