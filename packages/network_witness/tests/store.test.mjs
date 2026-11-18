import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,readFile,chmod} from 'node:fs/promises';
import {fixture} from './fixture.mjs';
import {openWitness} from '../lib/store.mjs';
import {ORIGIN,verifyReceipt} from '../lib/contract.mjs';
const start=f=>openWitness({logPath:f.logPath,trustPath:f.trustPath,keyPath:f.keyPath});
test('anchor persists a verifiable external receipt and survives restart',async()=>{
 const f=await fixture();let s;
 try{s=await start(f);const a=f.segment();const receipt=await s.anchor({...a,expectedRevision:ORIGIN});
  assert.equal(s.status().count,1);assert(verifyReceipt(receipt.receipt,receipt.signature,f.trust));
  assert.equal(receipt.receipt.checkpoint.head,a.checkpoint.head);
  assert(!JSON.stringify(s.list()).includes('privateKey'));await s.close();s=null;
  const disk=await readFile(f.logPath,'utf8');assert(!disk.includes('"type":"propose"'),'journal events must not be stored');
  s=await start(f);assert.equal(s.inspect(a.checkpoint,a.signature).state,'matches_witness');
 }finally{await s?.close();await f.remove();}
});
test('out-of-order, stale CAS and forked history are rejected',async()=>{
 const f=await fixture();let s;
 try{s=await start(f);const a=f.segment();await s.anchor({...a,expectedRevision:ORIGIN});
  await assert.rejects(s.anchor({...a,expectedRevision:ORIGIN}),/revision_conflict/);
  const gap=f.segment(1,a.checkpoint.head,[{type:'x'},{type:'y'}]);
  await assert.rejects(s.anchor({...gap,segment:gap.segment.slice(1),expectedRevision:s.head}),/invalid_chain/);
  const fork=f.segment(0,ORIGIN,[{type:'other'}]);
  assert.equal(s.inspect(fork.checkpoint,fork.signature).state,'fork_detected');
  assert.equal(s.inspect(gap.checkpoint,gap.signature).state,'ahead_of_witness');
 }finally{await s?.close();await f.remove();}
});
test('second signed checkpoint extends anchored chain and older signed proof flags rollback',async()=>{
 const f=await fixture();let s;
 try{s=await start(f);const a=f.segment(),r=await s.anchor({...a,expectedRevision:ORIGIN});
  const b=f.segment(a.checkpoint.seq,a.checkpoint.head,[{type:'endorse'}]);
  await s.anchor({...b,expectedRevision:r.witnessRevision});
  assert.equal(s.inspect(a.checkpoint,a.signature).state,'rollback_detected');
  assert.equal(s.inspect(b.checkpoint,b.signature).state,'matches_witness');
  assert.equal(s.list().receipts.length,2);
 }finally{await s?.close();await f.remove();}
});
test('witness refuses altered and truncated local history',async()=>{
 const f=await fixture();let s;
 try{s=await start(f);await s.anchor({...f.segment(),expectedRevision:ORIGIN});await s.close();s=null;
  const contents=await readFile(f.logPath,'utf8');await writeFile(f.logPath,contents.replace('approval','different'));
  await assert.rejects(start(f),/corrupt_witness_log|invalid_receipt/);
  await writeFile(f.logPath,contents.slice(0,-1));
  await assert.rejects(start(f),/truncated_witness_log/);
 }finally{await s?.close();await f.remove();}
});
test('single writer lock and unsafe key permissions deny startup',async()=>{
 const f=await fixture();let s;
 try{s=await start(f);await assert.rejects(start(f),/writer_already_active/);
  await s.close();s=null;await chmod(f.keyPath,0o644);
  await assert.rejects(start(f),/unsafe_private_file/);
 }finally{await s?.close();await f.remove();}
});
test('invalid source proof cannot be anchored',async()=>{
 const f=await fixture();let s;
 try{s=await start(f);const a=f.segment();a.signature='A'.repeat(88);
  await assert.rejects(s.anchor({...a,expectedRevision:ORIGIN}),/untrusted_checkpoint/);
  assert.equal(s.count,0);
 }finally{await s?.close();await f.remove();}
});
