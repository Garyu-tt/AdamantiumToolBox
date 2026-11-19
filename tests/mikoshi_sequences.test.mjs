import {strict as assert} from 'node:assert';
import {initialize,learn,predict,catalog,gapBand,validate} from
 '../apps/mikoshi_sequences/model.mjs';
const A='m00001',B='m00002',C='m00003',D='m00004';
const seq=(...ids)=>ids.map((id,i)=>({id,gapMs:i?250:0}));
const start=initialize(),original=structuredClone(start);
assert.deepEqual(predict(start,seq(A)).candidates,[]);
const first=learn(start,seq(A,B,C));
assert(first.result.updated);
assert.equal(first.result.discovered,3); // A→B, B→C, A→B→C
assert.equal(first.state.episodes,1);
assert(first.state.patterns.every(p=>p.events.every((e,j)=>
 j===0?e.gapMs===0:[90,300,650].includes(e.gapMs))),
 'persistent motor timing must be coarsely quantized');
assert.deepEqual(start,original,'source state must not change');
const again=learn(first.state,seq(A,B,C));
assert.equal(again.result.discovered,0);
assert.equal(again.result.reinforced,3);
const top=predict(again.state,seq(A,B));
assert.equal(top.matchedOrder,2);
assert.equal(top.candidates[0].nextId,C);
assert.equal(top.candidates[0].gapBand,'medium');
assert.equal(top.candidates[0].share,1);
const reversed=learn(again.state,seq(B,A,D));
assert.equal(predict(reversed.state,seq(A,B)).candidates[0].nextId,C);
assert.equal(predict(reversed.state,seq(B,A)).candidates[0].nextId,D);
assert.equal(predict(reversed.state,seq(B,D)).matchedOrder,0);
const branches=learn(reversed.state,seq(A,B,D));
const split=predict(branches.state,seq(A,B));
assert.equal(split.candidates.length,2);
assert.equal(split.candidates[0].nextId,C);
assert(split.candidates[0].share>split.candidates[1].share);
const unknown=predict(branches.state,seq(D,A,B));
assert.equal(unknown.matchedOrder,2,'suffix backoff should preserve A→B');
assert.equal(unknown.candidates[0].nextId,C);
const pauses=[{id:A,gapMs:0},{id:B,gapMs:1100},{id:C,gapMs:220}];
const paused=learn(branches.state,pauses);
assert(paused.result.updated);
assert.equal(predict(paused.state,seq(A)).candidates[0].nextId,B);
assert.equal(predict(paused.state,seq(B)).candidates[0].nextId,C);
assert.equal(gapBand(1100),'boundary');
assert.throws(()=>predict(paused.state,[{id:A,gapMs:0},{id:B,gapMs:1100}]),
 /sequence_boundary/);
const read=catalog(paused.state);
assert(read.frequent.length>0);
assert(!JSON.stringify(paused.state).includes('samples'));
validate(paused.state);
assert.throws(()=>learn(paused.state,[{id:'injected',gapMs:0},{id:B,gapMs:250}]),
 /invalid_sequence/);
assert.throws(()=>learn(paused.state,[{id:A,gapMs:0},{id:B,gapMs:-1}]),
 /invalid_sequence/);
assert.throws(()=>catalog({...paused.state,patterns:[...paused.state.patterns,
 paused.state.patterns[0]]}),/invalid_sequence_state/);
console.log('MIKOSHI_SEQUENCES_OK order, rhythm, boundary, backoff, persistence schema');
