import {strict as assert} from 'node:assert';
import {analyze} from '../apps/mikoshi_vision/encoder.mjs';
import {initialize,learn,associate,recall,catalog,validate} from
 '../apps/mikoshi_grounding/model.mjs';
const blank=Array(192).fill(0);
function paint(channel,amount=1){
 const p=[...blank];
 for(let y=2;y<5;y++)for(let x=2;x<5;x++)p[(y*8+x)*3+channel]=amount;
 return p;
}
const sample=amount=>analyze([{timeMs:0,pixels:blank},
 {timeMs:200,pixels:paint(0,amount)},
 {timeMs:400,pixels:blank},
 {timeMs:600,pixels:paint(2,amount)}]).events.filter(e=>e.kind==='appear');
const [red,blue]=sample(1),[redSoft]=sample(.92);
assert(red&&blue);
const a='m00001',b='m00002',before=initialize();
const pair=(event,soundId)=>({visualVector:event.vector,soundId,
 visualAtMs:event.timeMs,soundAtMs:event.timeMs+20,sourceApproved:true});
const one=learn(before,pair(red,a));
assert.equal(one.result.kind,'discovered');
assert.equal(associate(one.state,red.vector).ready,false);
assert.deepEqual(before,initialize(),'no mutation of previous state');
const two=learn(one.state,pair(redSoft,a));
assert.equal(two.result.visualId,one.result.visualId);
assert.equal(two.result.support,2);
const known=associate(two.state,red.vector);
assert(known.ready);
assert.equal(known.candidates[0].soundId,a);
assert.equal(recall(two.state,a).candidates[0].visualId,one.result.visualId);
const three=learn(two.state,pair(blue,b)),four=learn(three.state,pair(blue,b));
assert.equal(catalog(four.state).visuals,2);
assert.equal(associate(four.state,blue.vector).candidates[0].soundId,b);
assert.equal(associate(four.state,red.vector).candidates[0].soundId,a);
assert.equal(associate(four.state,blank.slice(0,10)).matched,false);
const conflicted=learn(learn(four.state,pair(red,b)).state,pair(red,b)).state;
assert.equal(associate(conflicted,red.vector).ready,false,
 'contradictory pairings must not be reported as learned');
assert.throws(()=>learn(four.state,{...pair(red,a),soundAtMs:900}),
 /invalid_temporal_pair/);
assert.throws(()=>learn(four.state,{...pair(red,a),sourceApproved:false}),
 /invalid_temporal_pair/);
assert.throws(()=>associate(four.state,[Infinity]),/invalid_visual_vector/);
assert.throws(()=>recall(four.state,'word'),/invalid_sound_id/);
assert(!JSON.stringify(four.state).includes('pixels'));
assert(!JSON.stringify(four.state).includes('samples'));
validate(four.state);
console.log('MIKOSHI_GROUNDING_OK repeated alignment, ambiguity, privacy and recall');
