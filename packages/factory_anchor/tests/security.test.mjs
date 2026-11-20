import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openFactoryAnchor} from '../lib/store.mjs';
import {verifySource,sha,ZERO} from '../lib/proof.mjs';
import {fixture} from './fixture.mjs';
const store=(f,allowSigning)=>openFactoryAnchor({
 root:f.root,anchorPin:f.anchorPin,sourcePin:f.sourcePin,
 ledgerId:f.ledgerId,allowSigning
});
test('forged source key, modified witness, forged signer, truncated journal all denied',async()=>{
 const f=await fixture();
 try{
  const a=store(f,true),source=f.bundle();
  const changedKey={...source,publicKeyPem:source.publicKeyPem.replace('A','B')};
  await assert.rejects(a.attest({
   bundle:changedKey,expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:sha('x')
  }),/public_key_pin_mismatch/);
  const changedJournal={...source,journalJSONL:source.journalJSONL.replace(
   'factory.proposed','factory.rejected')};
  const valid=verifySource(source,{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  await assert.rejects(a.attest({
   bundle:changedJournal,expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:valid.head
  }),/factory_journal_hash_invalid/);
  const changedProof={...source,
   witnessJSONL:source.witnessJSONL.replace(/"signature":"[A-Za-z0-9_-]+"/,
    '"signature":"'+'A'.repeat(86)+'"')};
  await assert.rejects(a.attest({
   bundle:changedProof,expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:valid.head
  }),/source_witness_signature_invalid/);
  await assert.rejects(a.attest({
   bundle:{...source,journalJSONL:'{}'},expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:valid.head
  }),/source_journal_torn_tail/);
  await assert.rejects(a.attest({
   bundle:source,expectedReceiptHash:ZERO,
   expectedSourceSequence:2,expectedSourceHead:valid.head
  }),/unsigned_or_stale_source/);
  assert.equal((await a.status()).checkpoints,0);
 }finally{await f.remove();}
});
test('stolen/spoofed signer identity and modified hash chain disable all actions',async()=>{
 const f=await fixture();
 try{
  const a=store(f,true);
  const source=verifySource(f.bundle(),{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  await a.attest({bundle:f.bundle(),expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:source.head});
  const path=join(f.root,'anchor.jsonl');
  const original=await readFile(path,'utf8');
  await writeFile(path,original.replace('factory-r09-tests','hijacked-ledger'));
  await assert.rejects(a.status(),/offhost_receipt_invalid|offhost_signature_invalid/);
  await assert.rejects(a.latest(),/offhost_receipt_invalid|offhost_signature_invalid/);
  await writeFile(path,original);
  await writeFile(join(f.root,'anchor-private.pem'),'not a private key');
  await assert.rejects(a.status(),/DECODER|unsupported|asn1|decode|key|invalid/i);
  const safe=store(f,false);
  assert.equal((await safe.status()).checkpoints,1);
 }finally{await f.remove();}
});
test('exclusive foreign writer lease is never broken by signer',async()=>{
 const f=await fixture();
 try{
  const a=store(f,true);
  const source=verifySource(f.bundle(),{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  const path=join(f.root,'anchor-writer.lock');
  await writeFile(path,'foreign-owner');
  await assert.rejects(a.attest({
   bundle:f.bundle(),expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:source.head
  }),/factory_anchor_lease_busy/);
  assert.equal(await readFile(path,'utf8'),'foreign-owner');
 }finally{await f.remove();}
});
test('invalid trust config and missing explicit trust pins fail closed',async()=>{
 const f=await fixture();
 try{
  assert.throws(()=>openFactoryAnchor({root:f.root,anchorPin:f.anchorPin}),
    /factory_anchor_trust_not_provisioned/);
  await assert.rejects(store({...f,anchorPin:'sha256:'+'f'.repeat(64)},false).status(),
    /offhost_identity_not_trusted/);
  await assert.rejects(store({...f,ledgerId:'different-ledger'},false).status(),
    /offhost_identity_not_trusted/);
 }finally{await f.remove();}
});
