import {strict as assert} from 'node:assert';
import {motor,generate,rank} from '../apps/mikoshi_hypotheses/model.mjs';
const base={f1:560,f2:1640},plan=generate(base);
assert.equal(plan.schema,'mikoshi.hypothesis.candidates.v1');
assert.equal(plan.candidates.length,8);
assert(plan.candidates.every(m=>m.f2-m.f1>=400));
assert.deepEqual(base,{f1:560,f2:1640},'no mutation');
const seen=new Set(plan.candidates.map(m=>m.f1+':'+m.f2));
assert.equal(seen.size,plan.candidates.length);
const unknown={ready:false,predicted:null,confidence:0,nearest:null,examples:0};
const first=rank(plan.candidates.map(m=>({motor:m,estimate:unknown})));
assert.equal(first.reason,'no_prior_observation');
assert.equal(first.informationScore,1);
assert.equal(first.expectedConfidence,0);
const zero=Array(10).fill(0);
const known={ready:true,predicted:zero,confidence:.96,nearest:.02,examples:15};
const uncertain={ready:true,predicted:zero,confidence:.15,nearest:.35,examples:15};
const choice=rank([{motor:plan.candidates[0],estimate:known},
 {motor:plan.candidates[1],estimate:uncertain}]);
assert.deepEqual(choice.motor,plan.candidates[1],
 'expected uncertainty should determine the next experiment');
assert(choice.informationScore>.5);
assert.throws(()=>motor({f1:950,f2:1000}),/invalid_hypothesis_motor/);
assert.throws(()=>generate(base,500,100),/invalid_hypothesis_steps/);
const edge=generate({f1:1050,f2:1450},180,420);
assert(edge.candidates.length>0&&edge.candidates.length<=8);
assert(edge.candidates.every(x=>x.f1>=250&&x.f1<=1050&&
 x.f2>=900&&x.f2<=3300&&x.f2-x.f1>=400));
assert.throws(()=>rank([]),/invalid_hypothesis_options/);
assert.throws(()=>rank([{motor:base,estimate:known},
 {motor:base,estimate:known}]),/duplicate_hypothesis_motor/);
assert.throws(()=>rank([{motor:base,estimate:{
 ...known,confidence:NaN}}]),/invalid_hypothesis_estimate/);
assert.throws(()=>rank([{motor:base,estimate:{
 ...known,predicted:[Infinity]}}]),/invalid_hypothesis_estimate/);
console.log('MIKOSHI_HYPOTHESES_OK bounded novelty search, ranking, validation');
