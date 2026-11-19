import {verifyForReservation} from './proof.mjs';
const safe=x=>Number.isSafeInteger(x)&&x>=0;
export function verifyStoredClaim(claim,id,trustRoot){
 if(!claim||claim.schema!=='rollback-ledger-claim-1'||claim.leaseId!==id||
  !safe(claim.reservedAt))throw Error('invalid_claim_metadata');
 const receipt={schema:'rollback-watchdog-approval-1',
  leaseId:claim.leaseId,targetNode:claim.targetNode,
  planDigest:claim.planDigest,baseRevision:claim.baseRevision,
  issuedAt:claim.issuedAt,expiresAt:claim.expiresAt,
  signature:claim.signature};
 const context={expectedLeaseId:id,expectedTargetNode:claim.targetNode,
  expectedPlanDigest:claim.planDigest,expectedBaseRevision:claim.baseRevision};
 const verified=verifyForReservation(receipt,context,trustRoot,claim.reservedAt);
 if(verified.keyFingerprint!==claim.keyFingerprint||
  verified.receiptHash!==claim.receiptHash||
  verified.expiresAt!==claim.expiresAt||verified.issuedAt!==claim.issuedAt)
  throw Error('stored_receipt_mismatch');
 return {signatureVerified:true,keyFingerprint:verified.keyFingerprint,
  reservationTimeAttested:false,filesystemIntegrityAttested:false,
  writerAuthenticated:false,kernelReadbackVerified:false,
  globalReplayProtection:false,readyToApply:false};
}
