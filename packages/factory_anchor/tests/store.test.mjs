// SPDX-License-Identifier: Apache-2.0
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
test('standalone Factory Anchor reads public proofs; cannot sign without explicit grant',async()=>{
 const f=await fixture();
 try{
  const a=store(f,false);
  const status=await a.status();
  assert.equal(status.configured,true);
  assert.equal(status.checkpoints,0);
  assert.equal(status.signingConfigured,false);
  assert.equal((await a.inspect({bundle:f.bundle()})).status,'unanchored');
  const source=verifySource(f.bundle(),{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  await assert.rejects(a.attest({
   bundle:f.bundle(),expectedReceiptHash:ZERO,
   expectedSourceSequence:source.sequence,expectedSourceHead:source.head
  }),/factory_anchor_signing_not_enabled/);
  assert.equal((await a.latest()).attestation,null);
  assert.equal((await a.status()).checkpoints,0);
 }finally{await f.remove();}
});
test('opt-in Ed25519 attestation is durable, CAS protected and advisory only',async()=>{
 const f=await fixture();
 try{
  const a=store(f,true);
  assert.equal((await a.status()).signingConfigured,true);
  const source=verifySource(f.bundle(),{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  const first=await a.attest({
   bundle:f.bundle(),expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:source.head
  });
  assert.equal(first.replayed,false);
  assert.equal(first.attestation.sourceSequence,1);
  assert.equal(first.masApprovalGranted,false);
  assert.equal(first.productionPublished,false);
  const receiptHash=first.attestation.receiptHash;
  assert.match(receiptHash,/^sha256:[a-f0-9]{64}$/);
  const copy=store(f,false);
  assert.equal((await copy.status()).checkpoints,1);
  const verified=await copy.inspect({bundle:f.bundle()});
  assert.equal(verified.status,'verified_current');
  assert.equal(verified.anchorSignatureValid,true);
  assert.equal(verified.sourceSignatureValid,true);
  assert.equal(verified.enforcement,false);
  await assert.rejects(a.attest({
   bundle:f.bundle(),expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:source.head
  }),/revision_conflict/);
  const replay=await a.attest({
   bundle:f.bundle(),expectedReceiptHash:receiptHash,
   expectedSourceSequence:1,expectedSourceHead:source.head
  });
  assert.equal(replay.replayed,true);
  assert.equal((await copy.status()).checkpoints,1);
  f.next();
  const advanced=verifySource(f.bundle(),{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  const before=await copy.inspect({bundle:f.bundle()});
  assert.equal(before.status,'verified_stale');
  const second=await a.attest({
   bundle:f.bundle(),expectedReceiptHash:receiptHash,
   expectedSourceSequence:2,expectedSourceHead:advanced.head
  });
  assert.equal(second.attestation.previousReceipt,receiptHash);
  assert.equal((await copy.status()).checkpoints,2);
  assert.equal((await copy.inspect({bundle:f.bundle()})).status,'verified_current');
  assert.equal((await readFile(join(f.root,'anchor.jsonl'),'utf8')).split('\n').filter(Boolean).length,2);
 }finally{await f.remove();}
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
