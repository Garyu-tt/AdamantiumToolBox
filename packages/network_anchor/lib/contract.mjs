import {createHash,createPublicKey,createPrivateKey,verify,sign} from 'node:crypto';
export const ORIGIN='0'.repeat(64);
export const sha=x=>createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const iso=x=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const decode=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(x))return null;
 const b=Buffer.from(x,'base64');return b.length===64&&b.toString('base64')===x?b:null;};
const publicDer=k=>(k?.type==='public'?k:createPublicKey(k)).export({format:'der',type:'spki'});
export function validTrust(t){
 if(t?.schema!=='network-anchor-trust-v1'||!t.anchor||!t.witness||!t.sources||
  typeof t.sources!=='object'||Array.isArray(t.sources)||Object.keys(t.sources).length>200)throw Error('invalid_trust');
 const list=[t.anchor,t.witness,...Object.values(t.sources)];const keys=[];
 for(const pin of list){if(!ident(pin?.id)||!ident(pin?.keyId)||typeof pin.publicKey!=='string'||pin.publicKey.length>1500)throw Error('invalid_trust');
  const k=createPublicKey(pin.publicKey);if(k.asymmetricKeyType!=='ed25519')throw Error('invalid_trust');keys.push(publicDer(k).toString('hex'));
 }
 if(new Set(keys).size!==keys.length||Object.entries(t.sources).some(([id,p])=>id!==p.id||!ident(id)))throw Error('shared_or_invalid_trust');
 return t;
}
export function verifyWitness(entry,trust){
 try{
  const r=entry?.receipt,c=r?.checkpoint,p=trust.sources[r?.journalId];
  if(!p||r.schema!=='network-witness-receipt-v1'||r.witnessId!==trust.witness.id||r.journalId!==c?.journalId||
   !Number.isSafeInteger(r.anchorSeq)||r.anchorSeq<1||!Number.isSafeInteger(r.ledgerSeq)||r.ledgerSeq<1||
   r.ledgerSeq!==c.seq||r.ledgerHead!==c.head||r.sourceProofHash!==sha(JSON.stringify({checkpoint:c,signature:r.sourceSignature}))||
   !hex(r.ledgerHead)||!hex(r.previousWitnessHead)||!iso(r.at)||!iso(c.at)||
   c.schema!=='network-approval-checkpoint-v1'||c.keyId!==p.keyId||!ident(c.journalId)||!ident(c.keyId)||
   !decode(entry.signature)||!decode(r.sourceSignature)||!hex(entry.witnessRevision))return false;
  const sourceBytes=Buffer.from('mechanicus.network.approval.checkpoint.v1\n'+JSON.stringify({schema:c.schema,
   journalId:c.journalId,seq:c.seq,head:c.head,keyId:c.keyId,at:c.at}));
  if(!verify(null,sourceBytes,createPublicKey(p.publicKey),decode(r.sourceSignature)))return false;
  const payload={schema:r.schema,witnessId:r.witnessId,journalId:r.journalId,
   anchorSeq:r.anchorSeq,ledgerSeq:r.ledgerSeq,ledgerHead:r.ledgerHead,
   previousWitnessHead:r.previousWitnessHead,sourceProofHash:r.sourceProofHash,
   checkpoint:{schema:c.schema,journalId:c.journalId,seq:c.seq,head:c.head,keyId:c.keyId,at:c.at},
   sourceSignature:r.sourceSignature,at:r.at};
  if(!verify(null,Buffer.from('mechanicus.network.witness.receipt.v1\n'+JSON.stringify(payload)),
   createPublicKey(trust.witness.publicKey),decode(entry.signature)))return false;
  return entry.witnessRevision===sha(JSON.stringify({seq:r.anchorSeq,previous:r.previousWitnessHead,record:r}));
 }catch{return false;}
}
export function attestationPayload(x){
 if(x?.schema!=='network-anchor-attestation-v1'||!ident(x.anchorId)||!ident(x.witnessId)||
  !Number.isSafeInteger(x.anchorSeq)||x.anchorSeq<1||!hex(x.anchorHead)||
  !Number.isSafeInteger(x.witnessSeq)||x.witnessSeq<1||!hex(x.witnessHead)||!iso(x.at))throw Error('invalid_attestation');
 return {schema:x.schema,anchorId:x.anchorId,witnessId:x.witnessId,
  anchorSeq:x.anchorSeq,anchorHead:x.anchorHead,witnessSeq:x.witnessSeq,witnessHead:x.witnessHead,at:x.at};
}
export const signAttestation=(a,key)=>sign(null,Buffer.from('mechanicus.network.anchor.v1\n'+JSON.stringify(attestationPayload(a))),key).toString('base64');
export function verifyAttestation(a,signature,trust){try{return !!decode(signature)&&a.anchorId===trust.anchor.id&&a.witnessId===trust.witness.id&&
 verify(null,Buffer.from('mechanicus.network.anchor.v1\n'+JSON.stringify(attestationPayload(a))),createPublicKey(trust.anchor.publicKey),decode(signature));}catch{return false;}}
export function keyFromPem(pem,trust){const k=createPrivateKey(pem);if(k.asymmetricKeyType!=='ed25519'||
 !publicDer(k).equals(publicDer(trust.anchor.publicKey)))throw Error('anchor_key_mismatch');return k;}
