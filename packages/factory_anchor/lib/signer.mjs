import {open,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {ZERO,sha,verifySource} from './proof.mjs';
import {fail,allowed,regular,atomicJson} from './file-io.mjs';
export async function attestInStore(self,params){return attest.call(self,params);}
async function attest({bundle,expectedReceiptHash,expectedSourceSequence,
    expectedSourceHead}={}){
  if(!this.allowSigning)fail('factory_anchor_signing_not_enabled');
  if(!allowed.test(expectedReceiptHash||'')||
    !Number.isSafeInteger(expectedSourceSequence)||expectedSourceSequence<1||
    !allowed.test(expectedSourceHead||''))
   fail('explicit_revision_cas_required');
  const lockPath=join(this.root,'anchor-writer.lock');
  let lock;
  try{lock=await open(lockPath,'wx',0o600);}
  catch(e){if(e.code==='EEXIST')fail('factory_anchor_lease_busy');throw e;}
  try{
   const state=await this.load();
   const last=state.chain.latest;
   if((last?.receiptHash||ZERO)!==expectedReceiptHash)
    fail('revision_conflict');
   const source=verifySource(bundle,{
    ledgerId:this.ledgerId,sourcePin:this.sourcePin
   });
   if(!source.current||source.sequence!==expectedSourceSequence||
       source.head!==expectedSourceHead)
    fail('unsigned_or_stale_source');
   if(last&&source.sourceWitnessId!==last.sourceWitnessId)
    fail('source_witness_identity_changed');
   if(last&&source.sequence<=last.sourceSequence){
    if(source.sequence===last.sourceSequence&&
      source.head===last.sourceHead&&
      source.sourceReceiptHash===last.sourceReceiptHash)
     return {replayed:true,attestation:last,masApprovalGranted:false};
    fail('anchor_source_history_conflict');
   }
   // Operator provisioned Ed25519 key: never exported, logged or emitted.
   const pem=await regular(join(this.root,'anchor-private.pem'),4096);
   const privateKey=createPrivateKey(pem);
   if(privateKey.asymmetricKeyType!=='ed25519')
    fail('anchor_private_algorithm_invalid');
   const publicPem=createPublicKey(privateKey).export({
    type:'spki',format:'pem'}).toString();
   if(sha(publicPem)!==this.anchorPin)fail('anchor_private_key_does_not_match_pin');
   const unsigned={
    schema:'adamantium.factory.offhost-receipt/1',
    anchorId:state.identity.anchorId,
    ledgerId:this.ledgerId,sourceWitnessId:source.sourceWitnessId,
    sourceKeyFingerprint:this.sourcePin,
    sourceSequence:source.sequence,sourceHead:source.head,
    sourceReceiptHash:source.sourceReceiptHash,
    previousReceipt:last?.receiptHash||ZERO,
    issuedAt:new Date().toISOString()
   };
   const signature=sign(null,Buffer.from(JSON.stringify(unsigned)),privateKey)
    .toString('base64url');
   const signed={...unsigned,signature};
   const attestation={...signed,receiptHash:sha(JSON.stringify(signed))};
   // Revalidate initial chain read, source proof and CAS before append.
   const prewrite=await this.load();
   if(prewrite.chain.receipts.length!==state.chain.receipts.length||
     prewrite.chain.latest?.receiptHash!==last?.receiptHash)
    fail('factory_anchor_mutated_during_attest');
   const fd=await open(join(this.root,'anchor.jsonl'),'a');
   try{
    await fd.writeFile(JSON.stringify(attestation)+'\n','utf8');
    await fd.sync();
   }finally{await fd.close();}
   const after=await this.load();
   if(after.chain.latest?.receiptHash!==attestation.receiptHash)
    fail('factory_anchor_readback_failed');
   await atomicJson(this.root,'anchor-view.json',{
    schema:'adamantium.factory.offhost-view/1',
    anchorId:state.identity.anchorId,
    anchorKeyFingerprint:this.anchorPin,sourceWitnessPublicKeyPin:this.sourcePin,
    sourceLedgerId:this.ledgerId,
    checkpoints:after.chain.receipts.length,latest:attestation,
    signatureVerified:true,offhostProofRecorded:true,
    physicallyIsolatedSignerVerified:false,
    masApprovalGranted:false,productionPublished:false
   });
   return {replayed:false,attestation,
    masApprovalGranted:false,productionPublished:false};
  }finally{await lock.close();await rm(lockPath,{force:true});}
 }
