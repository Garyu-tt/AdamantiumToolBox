import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
export const ORIGIN='0'.repeat(64);
export const sha=x=>createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const b64=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(x))return null;
 const v=Buffer.from(x,'base64');return v.length===64&&v.toString('base64')===x?v:null;};
export const pub=pem=>createPublicKey(pem).export({format:'der',type:'spki'});
export function checkpoint(journalId,keyId,seq,head,at){
 if(!ident(journalId)||!ident(keyId)||!Number.isSafeInteger(seq)||seq<1||!hex(head)||
  typeof at!=='string'||new Date(at).toISOString()!==at)throw Error('invalid_checkpoint');
 return {schema:'network-approval-checkpoint-v1',journalId,seq,head,keyId,at};
}
export function checkpointBytes(c){
 return Buffer.from('mechanicus.network.approval.checkpoint.v1\n'+JSON.stringify(checkpoint(c.journalId,c.keyId,c.seq,c.head,c.at)));
}
export function signCheckpoint(c,privatePem,publicPem){const key=createPrivateKey(privatePem);
 if(key.asymmetricKeyType!=='ed25519'||!pub(key).equals(pub(publicPem)))throw Error('source_signer_mismatch');
 return sign(null,checkpointBytes(c),key).toString('base64');}
export function verifyCheckpoint(c,signature,publicPem){const raw=b64(signature);
 try{return !!raw&&verify(null,checkpointBytes(c),createPublicKey(publicPem),raw);}catch{return false;}}
export function verifyLedger(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>8*1024*1024||raw&&!raw.endsWith('\n'))throw Error('journal_incomplete');
 const lines=raw?raw.slice(0,-1).split('\n'):[];let previous=ORIGIN,seq=0;const rows=[];
 for(const line of lines){let row;try{row=JSON.parse(line);}catch{throw Error('journal_corrupt');}
  if(row?.seq!==seq+1||row.previous!==previous||!hex(row.hash)||!row.event||typeof row.event!=='object'||
   row.hash!==sha(JSON.stringify({seq:row.seq,previous:row.previous,event:row.event})))throw Error('journal_corrupt');
  rows.push(row);seq=row.seq;previous=row.hash;
 }
 return {rows,seq,head:previous};
}
export function witnessReceipt(result,c,sourceSignature,witnessId,publicPem){
 const r=result?.receipt;
 if(!r||r.schema!=='network-witness-receipt-v1'||r.witnessId!==witnessId||r.journalId!==c.journalId||
 r.ledgerSeq!==c.seq||r.ledgerHead!==c.head||r.checkpoint?.journalId!==c.journalId||
 JSON.stringify(r.checkpoint)!==JSON.stringify(c)||r.sourceSignature!==sourceSignature||
 r.sourceProofHash!==sha(JSON.stringify({checkpoint:c,signature:sourceSignature}))||
 !hex(r.previousWitnessHead)||!Number.isSafeInteger(r.anchorSeq)||r.anchorSeq<1||
 !hex(result.witnessRevision)||!b64(result.signature))throw Error('invalid_witness_receipt');
 const bytes=Buffer.from('mechanicus.network.witness.receipt.v1\n'+JSON.stringify({schema:r.schema,
  witnessId:r.witnessId,journalId:r.journalId,anchorSeq:r.anchorSeq,ledgerSeq:r.ledgerSeq,
  ledgerHead:r.ledgerHead,previousWitnessHead:r.previousWitnessHead,sourceProofHash:r.sourceProofHash,
  checkpoint:r.checkpoint,sourceSignature:r.sourceSignature,at:r.at}));
 if(!verify(null,bytes,createPublicKey(publicPem),b64(result.signature))||
 result.witnessRevision!==sha(JSON.stringify({seq:r.anchorSeq,previous:r.previousWitnessHead,record:r})))throw Error('invalid_witness_signature');
 return {verified:true,ledgerSeq:r.ledgerSeq,ledgerHead:r.ledgerHead,witnessRevision:result.witnessRevision};
}
export function stateCheck(state,expected){
 if(state?.schema!=='network-checkpoint-state-v1'||state.witnessId!==expected.witnessId||
 state.journalId!==expected.journalId||!hex(state.witnessRevision)||!hex(state.ledgerHead)||
 !Number.isSafeInteger(state.ledgerSeq)||state.ledgerSeq<0)throw Error('invalid_remote_state');
 if(state.ledgerSeq===0&&state.ledgerHead!==ORIGIN)throw Error('invalid_genesis');
 if(state.ledgerSeq>0){if(!state.latest?.receipt)throw Error('invalid_witness_receipt');
  witnessReceipt(state.latest,state.latest.receipt.checkpoint,
  state.latest.receipt.sourceSignature,expected.witnessId,expected.publicKey);
  if(state.latest.receipt.ledgerSeq!==state.ledgerSeq||state.latest.receipt.ledgerHead!==state.ledgerHead)
   throw Error('remote_state_receipt_mismatch');}
 return state;
}
