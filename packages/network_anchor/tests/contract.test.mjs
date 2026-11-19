import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {fixture} from './fixture.mjs';
import {verifyWitness,validTrust,verifyAttestation,signAttestation,ORIGIN} from '../lib/contract.mjs';
test('independent pinned source/witness/anchor identities validate authentic Witness receipt',async()=>{
 const f=await fixture();try{assert.equal(validTrust(f.trust),f.trust);
  const row=f.next();assert(verifyWitness(row,f.trust));assert.equal(row.receipt.previousWitnessHead,ORIGIN);
  assert(!verifyWitness({...row,witnessRevision:'f'.repeat(64)},f.trust));
  assert(!verifyWitness({...row,signature:'f'.repeat(88)},f.trust));
  assert(!verifyWitness({...row,receipt:{...row.receipt,ledgerSeq:900}},f.trust));
  assert(!verifyWitness({...row,receipt:{...row.receipt,sourceSignature:'A'.repeat(88)}},f.trust));
 }finally{await f.remove();}
});
test('one signing key cannot stand in for another trust domain',async()=>{
 const f=await fixture();try{const bad=structuredClone(f.trust);bad.anchor.publicKey=bad.witness.publicKey;
  assert.throws(()=>validTrust(bad),/shared_or_invalid_trust/);
  bad.anchor.publicKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString();
  const row=f.next();assert(!verifyWitness(row,{...bad,witness:{...bad.witness,publicKey:bad.anchor.publicKey}}));
 }finally{await f.remove();}
});
test('anchor attestation binds identity, witness high-water and anchor revision',async()=>{
 const f=await fixture();try{const a={schema:'network-anchor-attestation-v1',anchorId:f.trust.anchor.id,
  witnessId:f.trust.witness.id,anchorSeq:1,anchorHead:'1'.repeat(64),witnessSeq:1,
  witnessHead:'2'.repeat(64),at:new Date().toISOString()};
  const proof=signAttestation(a,f.keys.anchor.privateKey);
  assert(verifyAttestation(a,proof,f.trust));
  assert(!verifyAttestation({...a,witnessHead:'3'.repeat(64)},proof,f.trust));
 }finally{await f.remove();}
});
