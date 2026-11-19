import {strict as assert} from 'node:assert';
import {issue,verify,validateClaim} from
 '../apps/mikoshi_sourcepolicy/policy.mjs';
const key='owner-kept-secret-0123456789-abcdef-0123456789';
const digest='a'.repeat(64),now=1_800_000_000_000;
const claim={sourceKind:'user-live-av',captureMethod:'explicit-gesture',
 purpose:'audiovisual-association-training',captureConsent:true,
 subjectsConsentConfirmed:true,noThirdPartyMedia:true,
 rawRetention:false,sessionDurationMs:2000,pairs:2,digest};
assert.equal(validateClaim(claim).pairs,2);
const permit=issue(key,claim,now);
assert.equal(permit.verifiedConsent,false);
const valid=verify(key,permit.token,digest,claim.purpose,now+5000);
assert.equal(valid.allowed,true);
assert.equal(valid.pairs,2);
assert.equal(valid.oneTime,false);
assert.throws(()=>verify(key,permit.token,'b'.repeat(64),
 claim.purpose,now+5000),/source_permit_expired_or_mismatched/);
assert.throws(()=>verify(key,permit.token,digest,
 claim.purpose,now+61000),/source_permit_expired_or_mismatched/);
assert.throws(()=>verify(key,permit.token,digest,
 claim.purpose,now-1),/source_permit_expired_or_mismatched/);
const [payload,sig]=permit.token.split('.');
const bad=payload+'.'+(sig[0]==='A'?'B':'A')+sig.slice(1);
assert.throws(()=>verify(key,bad,digest,claim.purpose,now),
 /invalid_source_signature/);
assert.throws(()=>issue('short',claim,now),/source_signing_key_missing/);
assert.throws(()=>issue(key,{...claim,subjectsConsentConfirmed:false},now),
 /source_policy_denied/);
assert.throws(()=>issue(key,{...claim,noThirdPartyMedia:false},now),
 /source_policy_denied/);
assert.throws(()=>issue(key,{...claim,rawRetention:true},now),
 /source_policy_denied/);
assert.throws(()=>issue(key,{...claim,sourceKind:'online-cartoon'},now),
 /source_policy_denied/);
console.log('MIKOSHI_SOURCEPOLICY_OK signed scoped 60s lessons, expiry, no consent claim');
