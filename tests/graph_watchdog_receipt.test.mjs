import {strict as assert} from 'node:assert';
import {generateKeyPairSync,sign} from 'node:crypto';
import {approvalPayload,inspectApproval} from '../apps/rollback_watchdog/receipt.mjs';
const hash=n=>String(n).repeat(64);
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const trustedPublicKey=publicKey.export({format:'der',type:'spki'}).toString('base64');
const issuedAt=1800000000,base={
 schema:'rollback-watchdog-approval-1',leaseId:'lease-1',targetNode:'host-a',
 planDigest:hash('a'),baseRevision:hash('b'),issuedAt,expiresAt:issuedAt+100};
const signature=sign(null,Buffer.from(approvalPayload(base)),privateKey).toString('base64');
const receipt={...base,signature};
const options={expectedLeaseId:base.leaseId,expectedTargetNode:base.targetNode,
 expectedPlanDigest:base.planDigest,expectedBaseRevision:base.baseRevision,
 trustedPublicKey,nowSeconds:issuedAt+10};
const valid=inspectApproval(receipt,options);
assert.equal(valid.signatureValid,true);
assert.equal(valid.trustAnchorPinned,true);
assert.equal(valid.planBound,true);
assert.equal(valid.readyToArm,false);
assert.equal(valid.readyToApply,false);
assert.equal(valid.replayProtection,false);
assert.equal(valid.nodeIdentityVerified,false);
assert.equal(inspectApproval(receipt,{...options,trustedPublicKey:''}).reason,
 'trust_anchor_or_signature_missing');
assert.equal(inspectApproval({...receipt,signature:sign(null,
 Buffer.from(approvalPayload({...base,planDigest:hash('c')})),privateKey).toString('base64')},
 options).reason,'signature_invalid');
assert.equal(inspectApproval({...receipt,planDigest:hash('c')},options).reason,
 'receipt_context_mismatch');
assert.equal(inspectApproval(receipt,{...options,nowSeconds:issuedAt+101}).reason,
 'receipt_time_invalid');
assert.equal(inspectApproval(receipt,{...options,expectedLeaseId:'lease-2'}).reason,
 'receipt_context_mismatch');
const other=generateKeyPairSync('ed25519').publicKey.export({
 format:'der',type:'spki'}).toString('base64');
assert.equal(inspectApproval(receipt,{...options,trustedPublicKey:other}).reason,
 'signature_invalid');
assert.throws(()=>approvalPayload({...base,expiresAt:issuedAt+10000}),
 /invalid_approval/);
console.log('GRAPH_WATCHDOG_RECEIPT_OK pinned signature, mismatch, expiry, no apply');
