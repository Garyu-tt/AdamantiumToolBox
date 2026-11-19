import {strict as assert} from 'node:assert';
import {issue,verify} from '../apps/mikoshi_sourcepolicy/policy.mjs';
import {audioHash,visualHash,digest,checkTicket,checkPair,decodePermit} from
 '../contracts/mikoshi-av-permit.mjs';
const secret='owner-r16-secret-longer-than-32-byte-string';
const now=1_800_000_000_000;
const samples=Array(2400).fill(.25),sampleRate=12000;
const visualVector=Array(10).fill(.4),visualAtMs=200,soundAtMs=230;
const claim={sourceKind:'user-live-av',captureMethod:'explicit-gesture',
 purpose:'audiovisual-association-training',captureConsent:true,
 subjectsConsentConfirmed:true,noThirdPartyMedia:true,
 rawRetention:false,sessionDurationMs:1200,pairs:1,
 digest:digest({source:'known synthetic unit-test'}),
 pairBindings:[{audioHash:audioHash(samples,sampleRate),
  visualHash:visualHash(visualVector,visualAtMs,soundAtMs)}]};
const permit=issue(secret,claim,now),p={sourcePermit:permit.token,
 lessonDigest:claim.digest,pairIndex:0,samples,sampleRate,
 visualVector,visualAtMs,soundAtMs};
assert.equal(verify(secret,permit.token,claim.digest,claim.purpose,now).permitVersion,2);
assert.equal(checkPair(secret,p,'audio',now).index,0);
assert.equal(checkPair(secret,p,'visual',now).index,0);
assert.throws(()=>checkPair(secret,p,'audio',now+60001),
 /source_permit_expired_or_mismatched/);
assert.equal(checkTicket(secret,p,now+60001,true).index,0,
 'expired write token can still read receipt');
assert.equal(checkTicket(secret,p,now+86399999,true).index,0);
assert.throws(()=>checkTicket(secret,p,now+86460001,true),
 /source_permit_expired_or_mismatched/);
assert.throws(()=>checkPair(secret,{...p,pairIndex:1},'audio',now),
 /source_pair_permit_required/);
assert.throws(()=>checkPair(secret,{...p,visualVector:Array(10).fill(.7)},
 'visual',now),/source_pair_digest_mismatch/);
const legacy=issue(secret,{...claim,pairBindings:undefined},now);
assert.equal(decodePermit(secret,legacy.token,now).v,1);
assert.throws(()=>checkPair(secret,{...p,sourcePermit:legacy.token},'audio',now),
 /source_pair_permit_required/);
console.log('MIKOSHI_R16_PERMIT_EXPIRY_OK v1 rejected, 60s write TTL, 24h readback');
