import {createPublicKey,createHash,verify} from 'node:crypto';
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const sec=x=>Number.isSafeInteger(x)&&x>=0;
const encoded=(s,size)=>{
 if(typeof s!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))return null;
 const out=Buffer.from(s,'base64');
 return out.length===size&&out.toString('base64')===s?out:null;
};
export function canonicalApproval(r){
 if(!r||r.schema!=='rollback-watchdog-approval-1'||
  !id(r.leaseId)||!id(r.targetNode)||!hex(r.planDigest)||
  !hex(r.baseRevision)||!sec(r.issuedAt)||!sec(r.expiresAt)||
  r.expiresAt<=r.issuedAt||r.expiresAt-r.issuedAt>600)
  throw Error('invalid_approval');
 return JSON.stringify([r.schema,r.leaseId,r.targetNode,r.planDigest,
  r.baseRevision,r.issuedAt,r.expiresAt]);
}
export function verifyForReservation(receipt,context,anchor,now){
 const payload=canonicalApproval(receipt);
 if(!context||!id(context.expectedLeaseId)||!id(context.expectedTargetNode)||
  !hex(context.expectedPlanDigest)||!hex(context.expectedBaseRevision)||
  receipt.leaseId!==context.expectedLeaseId||
  receipt.targetNode!==context.expectedTargetNode||
  receipt.planDigest!==context.expectedPlanDigest||
  receipt.baseRevision!==context.expectedBaseRevision)
  throw Error('lease_context_mismatch');
 if(!sec(now)||receipt.issuedAt>now+30||receipt.expiresAt<=now)
  throw Error('lease_expired_or_clock_invalid');
 const der=encoded(anchor,44),sig=encoded(receipt.signature,64);
 if(!der||!sig)throw Error('pinned_anchor_or_signature_missing');
 const publicKey=createPublicKey({key:der,format:'der',type:'spki'});
 if(publicKey.asymmetricKeyType!=='ed25519'||
  !verify(null,Buffer.from(payload,'utf8'),publicKey,sig))
  throw Error('lease_signature_invalid');
 const hash=x=>createHash('sha256').update(x).digest('hex');
 return {leaseId:receipt.leaseId,targetNode:receipt.targetNode,
  planDigest:receipt.planDigest,baseRevision:receipt.baseRevision,
  issuedAt:receipt.issuedAt,expiresAt:receipt.expiresAt,
  keyFingerprint:hash(der),receiptHash:hash(payload+'.'+receipt.signature)};
}
