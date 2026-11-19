import {strict as assert} from 'node:assert';
import {assess} from '../apps/mikoshi_reconciliation/model.mjs';
const now=1800000000000,expiresAt=now+10000;
const motif=(id='m00001')=>({applied:true,result:{
 id,sourceReceipt:'signed-receipt-value-0123456789'}});
const empty={applied:false,result:null};
const linked=(soundId='m00001')=>({applied:true,result:{
 visualId:'v00001',soundId}});
const rows=[{pairIndex:0,motif:motif(),grounding:linked()},
 {pairIndex:1,motif:motif('m00002'),grounding:empty}];
const s=assess(rows,expiresAt,now);
assert.equal(s.counts.complete,1);
assert.equal(s.counts.missingLink,1);
assert.equal(s.rows[1].advice,'explicit-link-only');
assert.equal(s.rows[1].resumable,true);
assert.equal(s.fullyApplied,false);
assert.equal(s.safeAutomaticWrites,false);
const expired=assess(rows,expiresAt,now+11000);
assert.equal(expired.writeWindowOpen,false);
assert.equal(expired.rows[1].resumable,false);
const all=assess([{pairIndex:0,motif:motif(),grounding:linked()}],
 expiresAt,now);
assert.equal(all.fullyApplied,true);
const wrong=assess([{pairIndex:0,motif:motif(),grounding:linked('m00003')}],
 expiresAt,now);
assert.equal(wrong.counts.inconsistent,1);
assert.equal(wrong.rows[0].advice,'quarantine-review');
const orphan=assess([{pairIndex:0,motif:empty,grounding:linked()}],
 expiresAt,now);
assert.equal(orphan.counts.inconsistent,1);
assert.equal(assess([{pairIndex:0,motif:empty,grounding:empty}],
 expiresAt,now).counts.missingBoth,1);
assert.throws(()=>assess([rows[0],rows[0]],expiresAt,now),
 /invalid_reconciliation_receipt/);
assert.throws(()=>assess([{pairIndex:0,motif:{applied:true},
 grounding:empty}],expiresAt,now),/invalid_reconciliation_receipt/);
assert.throws(()=>assess(rows,expiresAt,NaN),/invalid_reconciliation_input/);
console.log('MIKOSHI_RECONCILIATION_OK missing-link, inconsistent, expiry and strict abstention');
