// SPDX-License-Identifier: Apache-2.0
// Public-only proof verifier. Strictly independent of Node-RED, network_anchor,
// JediControl, Python, Noosphere and any other optional MAS application.
import {createHash,createPublicKey,verify} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const ZERO='sha256:'+'0'.repeat(64);
export const sha=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const hex=/^sha256:[a-f0-9]{64}$/;
const ident=/^[a-z][a-z0-9_.-]{2,95}$/;
const b64=/^[A-Za-z0-9_-]{70,128}$/;
const date=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const kinds=new Set(['factory.proposed','factory.verified','factory.rejected','factory.promotion.requested']);
const shape=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function records(json,max,name){
 if(typeof json!=='string'||Buffer.byteLength(json)>max)fail(name+'_size_limit');
 if(json&&!json.endsWith('\n'))fail(name+'_torn_tail');
 const rows=json.split('\n').filter(Boolean);
 if(rows.length>8192)fail(name+'_too_many');
 return rows.map(row=>{
  if(Buffer.byteLength(row)>16384)fail(name+'_row_too_large');
  try{return JSON.parse(row);}catch{fail(name+'_bad_json');}
 });
}
export function publicKey(pem,expectedFingerprint){
 if(typeof pem!=='string'||Buffer.byteLength(pem)>4096||
   !hex.test(expectedFingerprint||'')||sha(pem)!==expectedFingerprint)
  fail('public_key_pin_mismatch');
 let key;
 try{key=createPublicKey(pem);}
 catch{fail('malformed_pinned_public_key');}
 if(key.asymmetricKeyType!=='ed25519')fail('pinned_key_algorithm_invalid');
 return key;
}
export function verifySource(bundle,{ledgerId,sourcePin}={}){
 if(!shape(bundle,['schema','ledgerId','identity','publicKeyPem','journalJSONL','witnessJSONL'])||
    bundle.schema!=='adamantium.factory.public-bundle/1'||
    bundle.ledgerId!==ledgerId||!ident.test(ledgerId||'')||
    !hex.test(sourcePin||''))
  fail('invalid_factory_public_bundle');
 const identity=bundle.identity;
 if(!shape(identity,['schema','ledgerId','witnessId','keyFingerprint'])||
   identity.schema!=='adamantium.factory.witness-identity/1'||
   identity.ledgerId!==ledgerId||!ident.test(identity.witnessId||'')||
   identity.keyFingerprint!==sourcePin)
  fail('source_identity_pin_mismatch');
 const key=publicKey(bundle.publicKeyPem,sourcePin);
 const journal=records(bundle.journalJSONL,4*1024*1024,'source_journal');
 const checkpoints=records(bundle.witnessJSONL,3*1024*1024,'source_witness');
 let sequence=0,head=ZERO;
 const historical=new Map([[0,ZERO]]);
 for(const rec of journal){
  const keys=['schema','sequence','previous','kind','recordedAt','payload','hash'];
  if(!shape(rec,keys)||rec.schema!=='adamantium.factory.event/1'||
    !Number.isSafeInteger(rec.sequence)||rec.sequence!==sequence+1||
    rec.previous!==head||!kinds.has(rec.kind)||
    !date.test(rec.recordedAt||'')||!hex.test(rec.hash||'')||
    !rec.payload||typeof rec.payload!=='object'||Array.isArray(rec.payload))
   fail('factory_journal_invalid');
  const {hash,...unsigned}=rec;
  if(sha(JSON.stringify(unsigned))!==hash)fail('factory_journal_hash_invalid');
  sequence=rec.sequence;head=hash;historical.set(sequence,head);
 }
 let latest=null;
 const sourceReceipts=new Map();
 for(const receipt of checkpoints){
  const fields=['schema','ledgerId','witnessId','sequence','head',
   'previousReceipt','issuedAt','signature','receiptHash'];
  if(!shape(receipt,fields)||
    receipt.schema!=='adamantium.factory.witness-receipt/1'||
    receipt.ledgerId!==ledgerId||
    receipt.witnessId!==identity.witnessId||
    !Number.isSafeInteger(receipt.sequence)||
    receipt.sequence<=(latest?.sequence||0)||
    historical.get(receipt.sequence)!==receipt.head||
    receipt.previousReceipt!==(latest?.receiptHash||ZERO)||
    !date.test(receipt.issuedAt||'')||
    !b64.test(receipt.signature||'')||
    !hex.test(receipt.receiptHash||''))
   fail('source_witness_chain_invalid');
  const {signature,receiptHash,...unsigned}=receipt;
  let ok=false;
  try{ok=verify(null,Buffer.from(JSON.stringify(unsigned)),key,
   Buffer.from(signature,'base64url'));}
  catch{fail('source_witness_signature_invalid');}
  if(!ok)fail('source_witness_signature_invalid');
  if(sha(JSON.stringify({...unsigned,signature}))!==receiptHash)
   fail('source_witness_hash_invalid');
  latest=receipt;sourceReceipts.set(receipt.sequence,receipt);
 }
 if(!latest)fail('missing_source_checkpoint');
 return {
  ledgerId,sourceWitnessId:identity.witnessId,sourceKeyFingerprint:sourcePin,
  sequence,head,sourceReceiptHash:latest.receiptHash,
  signedSequence:latest.sequence,signedHead:latest.head,
  current:latest.sequence===sequence&&latest.head===head,
  sourceReceipts,historical
 };
}
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
