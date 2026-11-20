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
