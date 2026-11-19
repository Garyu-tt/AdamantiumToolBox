import {strict as assert} from 'node:assert';
import {webcrypto} from 'node:crypto';
import {permitLesson,verifyLesson,digestLesson,PURPOSE} from
 '../apps/mikoshi_classroom/av_policy.js';
import {issue,verify} from '../apps/mikoshi_sourcepolicy/policy.mjs';
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const secret='owner-policy-key-0123456789-abcdef-abcdef123456';
const item=(id)=>({visual:{vector:Array(10).fill(id/10)},
 pair:{visualAtMs:200*id,soundAtMs:200*id+10},
 audio:{samples:Array(2400).fill(.05*id)}});
const lesson=[item(1),item(2)];
const digest=await digestLesson(lesson);
assert.equal(digest.length,64);
assert.equal(digest,await digestLesson(structuredClone(lesson)));
const now=1_800_000_000_000,log=[];
const api={call:async(action,params)=>{
 log.push(action);
 if(action==='issue')return issue(secret,params.claim,now);
 if(action==='verify')return verify(secret,params.token,params.digest,
  params.purpose,now+10);
 throw Error('unknown_policy_action');
}};
const methods={authorize:'issue',verify:'verify'};
const permit=await permitLesson(api,methods,lesson,2000);
assert.equal(permit.digest,digest);
assert.deepEqual(log,['issue','verify']);
assert.equal((await verifyLesson(api,methods,lesson,permit)).allowed,true);
lesson[0].audio.samples[0]=.7;
await assert.rejects(verifyLesson(api,methods,lesson,permit),
 /lesson_changed_since_approval/);
await assert.rejects(permitLesson(api,{},lesson,2000),/source_policy_missing/);
await assert.rejects(permitLesson(api,methods,lesson,3000),
 /source_duration_invalid/);
assert.equal(PURPOSE,'audiovisual-association-training');
console.log('MIKOSHI_AV_POLICY_OK exact lesson digest, prior permit, tamper rejection');
