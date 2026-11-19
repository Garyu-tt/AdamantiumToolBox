import {strict as assert} from 'node:assert';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {spectrum} from '../apps/mikoshi_phonetics/spectrum.mjs';
import {initialize,estimate,begin,observe,abort,status,validate} from
 '../apps/mikoshi_worldmodel/model.mjs';
const a={f1:560,f2:1640},b={f1:700,f2:1880},mid={f1:630,f2:1760};
const hear=m=>spectrum(synth(m)),ticket=n=>String(n).padStart(8,'0')+
 '-1111-4111-8111-111111111111';
const original=initialize();assert.equal(estimate(original,mid).ready,false);
const first=begin(original,a,ticket(1));
assert.equal(first.result.ready,false);
assert.equal(status(first.state).pendingTicket,ticket(1));
assert.throws(()=>begin(first.state,b,ticket(2)),/prediction_pending/);
const learned=observe(first.state,ticket(1),hear(a));
assert.equal(learned.result.predicted,false);
assert.equal(learned.state.examples.length,1);
assert.deepEqual(original,initialize(),'model input must remain immutable');
assert.throws(()=>observe(learned.state,ticket(1),hear(a)),/stale_prediction_ticket/);
const proposed=estimate(learned.state,b);
assert.equal(proposed.ready,true);
assert(proposed.confidence>=0&&proposed.confidence<=1);
const second=begin(learned.state,b,ticket(2));
const after=observe(second.state,ticket(2),hear(b));
assert.equal(after.state.examples.length,2);
assert(after.result.predicted);
const intermediate=estimate(after.state,mid);
assert.equal(intermediate.ready,true);
assert.equal(intermediate.examples,2);
assert.equal(intermediate.predicted.length,10);
const actual=hear(mid),mse=(x,y)=>x.reduce((s,v,i)=>s+(v-y[i])**2,0)/10;
assert(mse(intermediate.predicted,actual)<.015,
 'model must predict a nearby unseen motor with bounded spectral error');
assert.notDeepEqual(intermediate.predicted,hear(a));
const third=begin(after.state,mid,ticket(3));
const evaluation=observe(third.state,ticket(3),actual);
assert.equal(evaluation.state.examples.length,3);
assert.equal(evaluation.result.predicted,true);
assert(evaluation.result.loss>=0&&evaluation.result.loss<.015);
const fourth=begin(evaluation.state,a,ticket(4));
const repeat=observe(fourth.state,ticket(4),hear(a));
assert.equal(repeat.state.examples.length,3,'repeated motor reinforces one example');
const unexpected=begin(repeat.state,a,ticket(5));
const upset=observe(unexpected.state,ticket(5),[1,0,0,0,0,0,0,0,0,0]);
assert(upset.result.surprise,'unexpected sensed outcome must be noticed');
assert(upset.state.surprises>=1);
assert.equal(status(upset.state).pendingTicket,null);
const stopped=abort(begin(upset.state,b,ticket(6)).state,ticket(6));
assert.equal(status(stopped).pendingTicket,null);
assert.throws(()=>abort(stopped,ticket(6)),/stale_prediction_ticket/);
assert.throws(()=>begin(stopped,{f1:100,f2:1100},ticket(7)),
 /invalid_prediction_motor/);
assert.throws(()=>observe(begin(stopped,a,ticket(8)).state,ticket(8),[NaN]),
 /invalid_prediction_vector/);
validate(upset.state);
assert(!JSON.stringify(upset.state).includes('samples'));
console.log('MIKOSHI_WORLDMODEL_OK unseen motor prediction, surprise, replay and bounded state');
