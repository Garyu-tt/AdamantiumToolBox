// SPDX-License-Identifier: Apache-2.0
// Independent append-only R08-compatible signer with no inherited host powers.
// All durable paths are operator-provisioned; no automatic key generation.
import {readFile,lstat,open,rm,rename,writeFile} from 'node:fs/promises';
import {resolve,join,parse,isAbsolute} from 'node:path';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {ZERO,sha,verifySource,checkAnchorIdentity,checkAnchorReceipts,
 verifyPublicAnchor} from './proof.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const allowed=/^sha256:[a-f0-9]{64}$/;
const ident=/^[a-z][a-z0-9_.-]{2,95}$/;
const required=(value,name)=>{
 if(typeof value!=='string'||!value)fail('missing_'+name);
 return value;
};
async function regular(path,max){
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size>max)
  fail('unsafe_factory_anchor_file');
 if(path.endsWith('anchor-private.pem')&&process.platform!=='win32'&&
   (st.mode&0o077)!==0)fail('private_key_permissions_too_broad');
 return readFile(path,'utf8');
}
async function atomicJson(root,name,data){
 const tmp=join(root,'.view-'+process.pid+'-'+Date.now()+'.tmp');
 try{
  await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(tmp,join(root,name));
 }finally{await rm(tmp,{force:true});}
}
export function openFactoryAnchor({root,anchorPin,sourcePin,ledgerId,
 allowSigning=false}={}){
 if(!isAbsolute(required(root,'root')))fail('factory_anchor_absolute_root_required');
 const folder=resolve(root);
 if(folder===parse(folder).root)fail('factory_anchor_root_forbidden');
 if(!allowed.test(anchorPin||'')||!allowed.test(sourcePin||'')||
   !ident.test(ledgerId||''))fail('factory_anchor_trust_not_provisioned');
 return new FactoryAnchorStore({folder,anchorPin,sourcePin,ledgerId,allowSigning});
}
class FactoryAnchorStore{
 constructor({folder,anchorPin,sourcePin,ledgerId,allowSigning}){
  this.root=folder;this.anchorPin=anchorPin;this.sourcePin=sourcePin;
  this.ledgerId=ledgerId;this.allowSigning=allowSigning===true;
 }
 async load(){
  const root=this.root;
  const [identityJSON,pem,log]=await Promise.all([
   regular(join(root,'anchor-identity.json'),4096),
   regular(join(root,'anchor-public.pem'),4096),
   regular(join(root,'anchor.jsonl'),3*1024*1024)
  ]);
  let identity;
  try{identity=JSON.parse(identityJSON);}catch{fail('anchor_identity_invalid_json');}
  const key=checkAnchorIdentity(identity,pem,{
   anchorPin:this.anchorPin,sourcePin:this.sourcePin,ledgerId:this.ledgerId
  });
  const chain=checkAnchorReceipts(log,{identity,publicKey:key});
  return {identity,pem,log,chain,key};
 }
 async status(){
  const state=await this.load();
  if(this.allowSigning){
   const pem=await regular(join(this.root,'anchor-private.pem'),4096);
   const key=createPrivateKey(pem);
   if(key.asymmetricKeyType!=='ed25519'||
     sha(createPublicKey(key).export({type:'spki',format:'pem'}).toString())!==this.anchorPin)
    fail('factory_anchor_signing_key_not_ready');
  }
  return {
   schema:'adamantium.factory_anchor.status/1',
   configured:true,app:'factory_anchor',version:'0.1.0',
   anchorId:state.identity.anchorId,
   anchorKeyFingerprint:this.anchorPin,sourceKeyFingerprint:this.sourcePin,
   ledgerId:this.ledgerId,
   checkpoints:state.chain.receipts.length,
   latestReceiptHash:state.chain.latest?.receiptHash||ZERO,
   latestSourceSequence:state.chain.latest?.sourceSequence??null,
   signingConfigured:this.allowSigning,
   // A local process cannot attest its own independent operator identity.
   independentHostValidated:false,
   masApprovalGranted:false,productionPublished:false,enforcement:false
  };
 }
 async latest(){
  const state=await this.load();
  return {
   schema:'adamantium.factory_anchor.latest/1',
   attestation:state.chain.latest,
   anchorPublicPem:state.pem,
   anchorIdentity:state.identity,
   signingPrivateKeyExposed:false,
   grantsMAS:false,productionPublished:false
  };
 }
 async inspect({bundle}={}){
  const state=await this.load();
  try{
   return verifyPublicAnchor({
    bundle,anchorIdentity:state.identity,anchorPublicPem:state.pem,
    anchorJSONL:state.log,ledgerId:this.ledgerId,
    anchorPin:this.anchorPin,sourcePin:this.sourcePin
   });
  }catch(e){
   if(e?.code==='anchor_checkpoint_absent')
    return {schema:'adamantium.factory_anchor.verification/1',
     status:'unanchored',anchorReceiptHash:ZERO,
     masApprovalGranted:false,productionPublished:false,enforcement:false};
   throw e;
  }
 }
 async attest({bundle,expectedReceiptHash,expectedSourceSequence,
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
}
