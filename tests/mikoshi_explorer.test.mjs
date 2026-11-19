import {strict as assert} from 'node:assert';
import {initialize,begin,propose,observe,stop,status,validate} from
 '../apps/mikoshi_explorer/model.mjs';
const A='m00001',B='m00002',SID='11111111-1111-4111-8111-111111111111';
const blank=initialize(),s=begin(blank,[A,B],6,SID);
assert.deepEqual(blank,initialize(),'immutable source state');
assert.equal(propose(s).action,'inspect');
assert.equal(propose(s).id,A);
const feedback=(state,loss)=>{
 const p=propose(state);assert(p.ready);
 return observe(state,{...p,loss});
};
let next=feedback(s,.22).state;
assert.equal(propose(next).action,'inspect');
assert.equal(propose(next).id,B);
next=feedback(next,.64).state;
assert.equal(propose(next).action,'practice');
assert.equal(propose(next).id,B,'chooses harder untrained sound');
const first=propose(next),up=feedback(next,.40);
assert(up.result.progress>.20);
assert.equal(up.state.session.skills[1].loss,.40);
assert.equal(next.session.skills[1].loss,.64,'no in-place mutation');
assert.throws(()=>observe(up.state,{...first,loss:.2}),/stale_exploration_feedback/);
let cur=up.state;
const used=[first.id];
while(propose(cur).ready){
 const p=propose(cur);used.push(p.id);
 cur=feedback(cur,p.id===A?.15:.35).state;
}
assert.equal(status(cur).session.status,'complete');
assert.equal(status(cur).session.step,6);
assert(used.includes(A),'policy eventually explores the second skill');
const old=status(cur);
assert.equal(old.session.history.length,6);
assert(old.session.history.every(x=>!('samples' in x)));
validate(cur);
assert.throws(()=>begin(s,[A,B],4,SID),/exploration_session_active/);
assert.throws(()=>begin(blank,[A,A],4,SID),/invalid_exploration_budget/);
assert.throws(()=>begin(blank,[A,B],15,SID),/invalid_exploration_budget/);
assert.throws(()=>observe(s,{...propose(s),loss:NaN}),/invalid_exploration_loss/);
const stopped=stop(s,SID);
assert.equal(stopped.session.status,'stopped');
assert.equal(propose(stopped).ready,false);
const resumed=begin(stopped,[B,A],3,SID);
assert.equal(propose(resumed).id,B);
console.log('MIKOSHI_EXPLORER_OK adaptive selection, budget, immutable state, replay denial');
