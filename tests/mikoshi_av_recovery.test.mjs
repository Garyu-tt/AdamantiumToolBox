import {strict as assert} from 'node:assert';
import {webcrypto} from 'node:crypto';
import {digestLesson} from '../apps/mikoshi_classroom/av_policy.js';
import {inspectRecovery,resumeMissingLinks} from
 '../apps/mikoshi_classroom/av_recovery.js';
import {assess} from '../apps/mikoshi_reconciliation/model.mjs';
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const now=Date.now(),audio=Array(2400).fill(.2);
const lesson=[{visual:{vector:Array(10).fill(.4)},
 audio:{samples:audio},pair:{visualAtMs:200,soundAtMs:215}}];
const signed={token:'test-signed-token',digest:await digestLesson(lesson),
 expiresAt:now+30000,pairs:1};
const actions={motifReceipt:'motifReceipt',
 groundingReceipt:'groundingReceipt',reconcile:'assess',
 teach:'teach',policy:{verify:'verify'}};
let applied=false,links=0;
const source={applied:true,result:{
 id:'m00001',sourceReceipt:'signature-0123456789-abcdef'}};
const app={call:async(action,params)=>{
 if(action==='motifReceipt')return source;
 if(action==='groundingReceipt')return applied?{applied:true,
  result:{visualId:'v00001',soundId:'m00001'}}:{applied:false,result:null};
 if(action==='assess')return assess(params.rows,params.expiresAt,Date.now());
 if(action==='verify')return {allowed:true,pairs:1,permitVersion:2};
 if(action==='teach'){
  assert.equal(params.soundId,'m00001');
  assert.equal(params.motifReceipt,source.result.sourceReceipt);
  assert.equal(params.visualAtMs,200);
  assert.equal(params.sourcePermit,signed.token);
  links++;applied=true;return {visualId:'v00001',soundId:'m00001'};
 }
 throw Error('unexpected action '+action);
}};
const inspected=await inspectRecovery(app,actions,signed,1);
assert.equal(inspected.assessment.counts.missingLink,1);
assert.equal(links,0,'inspection must never modify memory');
const recovered=await resumeMissingLinks(app,actions,lesson,signed);
assert.equal(recovered.resumed,1);
assert.equal(recovered.completed,true);
assert.equal(links,1);
const duplicate=await resumeMissingLinks(app,actions,lesson,signed);
assert.equal(duplicate.resumed,0);
assert.equal(links,1,'no second write when complete');
applied=false;
const old={...signed,expiresAt:now-1};
await assert.rejects(resumeMissingLinks(app,actions,lesson,old),
 /reconciliation_requires_manual_review/);
assert.equal(links,1);
const corrupt={call:async(action,params)=>{
 if(action==='motifReceipt')return source;
 if(action==='groundingReceipt')return {applied:true,result:{
  visualId:'v00001',soundId:'m00003'}};
 if(action==='assess')return assess(params.rows,params.expiresAt,Date.now());
 throw Error('unexpected');
}};
await assert.rejects(resumeMissingLinks(corrupt,actions,lesson,signed),
 /reconciliation_requires_manual_review/);
assert.equal(links,1);
lesson[0].audio.samples[0]=.99;
await assert.rejects(resumeMissingLinks(app,actions,lesson,signed),
 /lesson_changed_since_approval/);
assert.equal(links,1,'tampered lesson must not write');
console.log('MIKOSHI_AV_RECOVERY_OK explicit link-only retry, no duplicates, expiry and mismatch');
