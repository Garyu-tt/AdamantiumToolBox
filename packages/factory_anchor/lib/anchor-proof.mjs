import {createPublicKey,verify} from 'node:crypto';
import {ZERO,sha,records,publicKey,verifySource} from './source-proof.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hex=/^sha256:[a-f0-9]{64}$/;
const ident=/^[a-z][a-z0-9_.-]{2,95}$/;
const b64=/^[A-Za-z0-9_-]{70,128}$/;
const date=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const shape=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function checkAnchorIdentity(identity,pem,{anchorPin,sourcePin,ledgerId}={}){
 const fields=['schema','anchorId','keyFingerprint','sourceKeyPin','sourceLedgerId'];
 if(!shape(identity,fields)||
   identity.schema!=='adamantium.factory.offhost-anchor/1'||
   !ident.test(identity.anchorId||'')||
   identity.keyFingerprint!==anchorPin||
   identity.sourceKeyPin!==sourcePin||
   identity.sourceLedgerId!==ledgerId)
  fail('offhost_identity_not_trusted');
 return publicKey(pem,anchorPin);
}
export function checkAnchorReceipts(json,{identity,publicKey:anchorKey,source=null}={}){
 const receipts=records(json,3*1024*1024,'anchor');
 let last=null;
 for(const rec of receipts){
  const fields=[
   'schema','anchorId','ledgerId','sourceWitnessId',
   'sourceKeyFingerprint','sourceSequence','sourceHead',
   'sourceReceiptHash','previousReceipt','issuedAt','signature','receiptHash'
  ];
  if(!shape(rec,fields)||rec.schema!=='adamantium.factory.offhost-receipt/1'||
   rec.anchorId!==identity.anchorId||rec.ledgerId!==identity.sourceLedgerId||
   rec.sourceKeyFingerprint!==identity.sourceKeyPin||
   !ident.test(rec.sourceWitnessId||'')||
   !Number.isSafeInteger(rec.sourceSequence)||rec.sourceSequence<=0||
   rec.sourceSequence<=(last?.sourceSequence||0)||
   !hex.test(rec.sourceHead||'')||!hex.test(rec.sourceReceiptHash||'')||
   rec.previousReceipt!==(last?.receiptHash||ZERO)||
   !date.test(rec.issuedAt||'')||
   !b64.test(rec.signature||'')||!hex.test(rec.receiptHash||''))
   fail('offhost_receipt_invalid');
  if(last&&rec.sourceWitnessId!==last.sourceWitnessId)
   fail('source_witness_identity_changed');
  if(source){
   const matching=source.sourceReceipts.get(rec.sourceSequence);
   if(source.historical.get(rec.sourceSequence)!==rec.sourceHead||
      !matching||matching.receiptHash!==rec.sourceReceiptHash||
      source.sourceWitnessId!==rec.sourceWitnessId)
    fail('offhost_source_history_mismatch');
  }
  const {signature,receiptHash,...unsigned}=rec;
  let ok=false;
  try{ok=verify(null,Buffer.from(JSON.stringify(unsigned)),anchorKey,
    Buffer.from(signature,'base64url'));}
  catch{fail('offhost_signature_invalid');}
  if(!ok)fail('offhost_signature_invalid');
  if(sha(JSON.stringify({...unsigned,signature}))!==receiptHash)
   fail('offhost_receipt_hash_invalid');
  last=rec;
 }
 return {receipts,latest:last};
}
export function verifyPublicAnchor({bundle,anchorIdentity,anchorPublicPem,anchorJSONL,
 ledgerId,sourcePin,anchorPin}={}){
 const source=verifySource(bundle,{ledgerId,sourcePin});
 const key=checkAnchorIdentity(anchorIdentity,anchorPublicPem,{
  anchorPin,sourcePin,ledgerId
 });
 const chain=checkAnchorReceipts(anchorJSONL,{
  identity:anchorIdentity,publicKey:key,source
 });
 const last=chain.latest;
 if(!last)fail('anchor_checkpoint_absent');
 const current=source.current&&last.sourceSequence===source.sequence&&
   last.sourceHead===source.head&&last.sourceReceiptHash===source.sourceReceiptHash;
 return {
  schema:'adamantium.factory_anchor.verification/1',
  status:current?'verified_current':'verified_stale',
  ledgerId,sourceSequence:source.sequence,anchorSequence:last.sourceSequence,
  sourceWitnessId:source.sourceWitnessId,
  sourceKeyFingerprint:sourcePin,anchorKeyFingerprint:anchorPin,
  sourceSignatureValid:true,anchorSignatureValid:true,
  sourceHistoryValid:true,anchorHistoryValid:true,
  anchorReceiptHash:last.receiptHash,checkpointCount:chain.receipts.length,
  independentlyOperated:false,
  masApprovalGranted:false,productionPublished:false,enforcement:false
 };
}
export const deniedView=code=>({
 schema:'adamantium.factory_anchor.verification/1',status:'invalid',
 reason:code||'not_verified',sourceSignatureValid:false,anchorSignatureValid:false,
 sourceHistoryValid:false,anchorHistoryValid:false,
 independentlyOperated:false,masApprovalGranted:false,
 productionPublished:false,enforcement:false
});
