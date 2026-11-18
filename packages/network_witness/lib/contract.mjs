import {createHash,createPublicKey,verify,sign,createPrivateKey} from 'node:crypto';
export const ORIGIN='0'.repeat(64);
export const SOURCE_SCHEMA='network-approval-checkpoint-v1';
export const RECEIPT_SCHEMA='network-witness-receipt-v1';
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
export const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const isDate=x=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export function validateTrust(t){
 if(!t||t.schema!=='network-witness-trust-v1'||!t.witness||!t.sources||
  typeof t.sources!=='object'||Array.isArray(t.sources)||Object.keys(t.sources).length>200)throw Error('invalid_trust');
 const witnesses=[t.witness,...Object.values(t.sources)];const keys=[];
 for(const w of witnesses){
  if(!w||!ident(w.keyId)||!ident(w.id)||typeof w.publicKey!=='string'||w.publicKey.length>1500)throw Error('invalid_trust');
  const k=createPublicKey(w.publicKey);if(k.asymmetricKeyType!=='ed25519')throw Error('invalid_trust');
  keys.push(k.export({type:'spki',format:'der'}).toString('base64'));
 }
 if(new Set(keys).size!==keys.length||Object.entries(t.sources).some(([k,v])=>!ident(k)||k!==v.id))throw Error('identity_not_independent');
 return t;
}
const sigBytes=s=>{
 if(typeof s!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))return null;
 const x=Buffer.from(s,'base64');return x.length===64&&x.toString('base64')===s?x:null;
};
export function canonicalCheckpoint(c){
 if(!c||c.schema!==SOURCE_SCHEMA||!ident(c.journalId)||!ident(c.keyId)||
  !Number.isSafeInteger(c.seq)||c.seq<1||!hex(c.head)||!isDate(c.at))throw Error('invalid_checkpoint');
 return {schema:SOURCE_SCHEMA,journalId:c.journalId,seq:c.seq,head:c.head,keyId:c.keyId,at:c.at};
}
export const sourceBytes=c=>Buffer.from('mechanicus.network.approval.checkpoint.v1\n'+JSON.stringify(canonicalCheckpoint(c)));
export function verifySource(checkpoint,signature,trust){
 try{const c=canonicalCheckpoint(checkpoint),p=trust.sources[c.journalId];
  if(!p||p.keyId!==c.keyId)return false;
  const raw=sigBytes(signature);return !!raw&&verify(null,sourceBytes(c),createPublicKey(p.publicKey),raw);
 }catch{return false;}
}
export function validateSegment(rows,baseSeq,baseHead,checkpoint){
 const c=canonicalCheckpoint(checkpoint);
 if(!Array.isArray(rows)||rows.length<1||rows.length>32)throw Error('invalid_segment');
 let prev=baseHead,seq=baseSeq;
 for(const row of rows){
  if(!row||row.seq!==seq+1||row.previous!==prev||!hex(row.hash)||
    !row.event||typeof row.event!=='object'||Array.isArray(row.event))throw Error('invalid_chain');
  const expected=hash(JSON.stringify({seq:row.seq,previous:row.previous,event:row.event}));
  if(row.hash!==expected)throw Error('invalid_chain');seq=row.seq;prev=row.hash;
 }
 if(seq!==c.seq||prev!==c.head)throw Error('checkpoint_not_at_segment_tip');
 return {seq,head:prev};
}
export function receiptPayload(r){
 if(!r||r.schema!==RECEIPT_SCHEMA||!ident(r.witnessId)||!ident(r.journalId)||
  !Number.isSafeInteger(r.anchorSeq)||r.anchorSeq<1||!Number.isSafeInteger(r.ledgerSeq)||r.ledgerSeq<1||
  !hex(r.ledgerHead)||!hex(r.previousWitnessHead)||!hex(r.sourceProofHash)||!isDate(r.at)||
  typeof r.sourceSignature!=='string'||!sigBytes(r.sourceSignature))throw Error('invalid_receipt');
 return {schema:RECEIPT_SCHEMA,witnessId:r.witnessId,journalId:r.journalId,
  anchorSeq:r.anchorSeq,ledgerSeq:r.ledgerSeq,ledgerHead:r.ledgerHead,
  previousWitnessHead:r.previousWitnessHead,sourceProofHash:r.sourceProofHash,
  checkpoint:canonicalCheckpoint(r.checkpoint),sourceSignature:r.sourceSignature,at:r.at};
}
const receiptBytes=r=>Buffer.from('mechanicus.network.witness.receipt.v1\n'+JSON.stringify(receiptPayload(r)));
export function sealReceipt(record,privateKey){return sign(null,receiptBytes(record),privateKey).toString('base64');}
export function verifyReceipt(record,signature,trust){
 try{const raw=sigBytes(signature);return !!raw&&record.witnessId===trust.witness.id&&
  verify(null,receiptBytes(record),createPublicKey(trust.witness.publicKey),raw);
 }catch{return false;}
}
export function validatePrivateKey(pem,trust){
 const key=createPrivateKey(pem),pub=createPublicKey(key);
 if(key.asymmetricKeyType!=='ed25519'||!pub.export({type:'spki',format:'der'}).equals(
 createPublicKey(trust.witness.publicKey).export({type:'spki',format:'der'})))throw Error('witness_key_mismatch');
 return key;
}
export const sourceProofHash=(checkpoint,signature)=>hash(JSON.stringify({checkpoint:canonicalCheckpoint(checkpoint),signature}));
export const rowHash=(seq,previous,record)=>hash(JSON.stringify({seq,previous,record}));
