import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {validateTrust,validateSegment,verifySource,sourceBytes,verifyReceipt,sealReceipt,
 validatePrivateKey,ORIGIN,SOURCE_SCHEMA} from '../lib/contract.mjs';

test('signed source checkpoint and exact journal segment validate',async()=>{
 const f=await fixture();try{const a=f.segment();assert(verifySource(a.checkpoint,a.signature,f.trust));
  assert.equal(validateSegment(a.segment,0,ORIGIN,a.checkpoint).head,a.checkpoint.head);
  assert(sourceBytes(a.checkpoint).includes(Buffer.from(SOURCE_SCHEMA)));}finally{await f.remove();}
});
test('wrong source key, wrong checkpoint and bad signature fail closed',async()=>{
 const f=await fixture();try{const a=f.segment();assert(!verifySource({...a.checkpoint,head:'a'.repeat(64)},a.signature,f.trust));
  assert(!verifySource(a.checkpoint,a.signature.slice(1),f.trust));
  assert(!verifySource({...a.checkpoint,journalId:'unknown'},a.signature,f.trust));}finally{await f.remove();}
});
test('segment cannot jump over omitted ledger entries or modify prior hash',async()=>{
 const f=await fixture();try{const a=f.segment();
  assert.throws(()=>validateSegment(a.segment,1,ORIGIN,a.checkpoint),/invalid_chain/);
  assert.throws(()=>validateSegment([{...a.segment[0],hash:'f'.repeat(64)}],0,ORIGIN,a.checkpoint),/invalid_chain/);
  assert.throws(()=>validateSegment([],0,ORIGIN,a.checkpoint),/invalid_segment/);
 }finally{await f.remove();}
});
test('foreign signing identity cannot masquerade as witness',async()=>{
 const f=await fixture();try{assert.throws(()=>validatePrivateKey(f.source.privateKey.export({type:'pkcs8',format:'pem'}),f.trust),/mismatch/);
  const t=structuredClone(f.trust);t.sources.approval.publicKey=t.witness.publicKey;
  assert.throws(()=>validateTrust(t),/independent/);}finally{await f.remove();}
});
