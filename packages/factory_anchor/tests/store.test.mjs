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
