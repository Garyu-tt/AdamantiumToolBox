import {createPublicKey,createHash,verify} from 'node:crypto';
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const seconds=x=>Number.isSafeInteger(x)&&x>=0;
const b64=(s,size)=>{
 if(typeof s!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))return null;
 const buf=Buffer.from(s,'base64');
 return buf.length===size&&buf.toString('base64')===s?buf:null;
};
export function approvalPayload(r){
 if(!r||r.schema!=='rollback-watchdog-approval-1'||!id(r.leaseId)||
    !id(r.targetNode)||!hash(r.planDigest)||!hash(r.baseRevision)||
    !seconds(r.issuedAt)||!seconds(r.expiresAt)||
    r.expiresAt<=r.issuedAt||r.expiresAt-r.issuedAt>600)throw Error('invalid_approval');
 return JSON.stringify([r.schema,r.leaseId,r.targetNode,r.planDigest,
  r.baseRevision,r.issuedAt,r.expiresAt]);
}
export function inspectApproval(receipt,options={}){
 const base={schema:'rollback-watchdog-receipt-check-1',signatureValid:false,
  planBound:false,trustAnchorPinned:false,expirationVerified:false,
  nodeIdentityVerified:false,replayProtection:false,readyToArm:false,
  readyToApply:false,productionWatchdogArmed:false};
 let payload;
 try{payload=approvalPayload(receipt);}
 catch{return {...base,reason:'invalid_receipt'};}
 if(!hash(options.expectedPlanDigest)||!hash(options.expectedBaseRevision)||
  !id(options.expectedTargetNode)||!id(options.expectedLeaseId))
  return {...base,reason:'expected_context_missing'};
 if(receipt.planDigest!==options.expectedPlanDigest||
    receipt.baseRevision!==options.expectedBaseRevision||
    receipt.targetNode!==options.expectedTargetNode||
    receipt.leaseId!==options.expectedLeaseId)
  return {...base,reason:'receipt_context_mismatch'};
 const bound={...base,planBound:true};
 const now=options.nowSeconds??Math.floor(Date.now()/1000);
 if(!seconds(now))return {...bound,reason:'clock_unavailable'};
 if(receipt.issuedAt>now+30||receipt.expiresAt<=now)
  return {...bound,reason:'receipt_time_invalid'};
 const time={...bound,expirationVerified:true};
 const raw=b64(options.trustedPublicKey,44),signature=b64(receipt.signature,64);
 if(!raw||!signature)return {...time,reason:'trust_anchor_or_signature_missing'};
 try{
  const key=createPublicKey({key:raw,format:'der',type:'spki'});
  if(key.asymmetricKeyType!=='ed25519')return {...time,reason:'wrong_signature_algorithm'};
  const fingerprint=createHash('sha256').update(raw).digest('hex');
  const pinned={...time,trustAnchorPinned:true,keyFingerprint:fingerprint};
  if(!verify(null,Buffer.from(payload,'utf8'),key,signature))
   return {...pinned,reason:'signature_invalid'};
  return {...pinned,signatureValid:true,reason:'signature_only_no_attested_node_or_replay_db'};
 }catch{return {...time,reason:'trust_anchor_invalid'};}
}
