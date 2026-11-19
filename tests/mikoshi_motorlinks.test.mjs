import {strict as assert} from 'node:assert';
import {initialize,validate,propose,feedback,catalog} from
 '../apps/mikoshi_motorlinks/model.mjs';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {spectrum,distance} from '../apps/mikoshi_phonetics/spectrum.mjs';
// A test composer supplies the actuator+hearing; the controller imports neither.
const id='m00001',teacher=spectrum(synth({f1:810,f2:1290}));
const score=m=>distance(teacher,spectrum(synth(m)));
let state=initialize(),old=structuredClone(state);
const initial=score(propose(state,id).candidate);let last=Infinity;
for(let i=0;i<80;i++){
 const p=propose(state,id);if(!p.ready)break;
 const reward=score(p.candidate);
 const r=feedback(state,{id,trial:p.trial,candidate:p.candidate,loss:reward});
 assert(r.result.bestLoss<=last+1e-8);
 last=r.result.bestLoss;state=r.state;
}
assert(state.records.length===1);
assert(propose(state,id).trials>=25);
assert(state.records[0].bestLoss<initial*.85,'auditory reward should guide motor learning');
assert.equal(catalog(state).records[0].id,id);
assert.deepEqual(old,initialize(),'new trials cannot mutate previous state');
const p=propose(state,id);
if(p.ready){
 assert.throws(()=>feedback(state,{id,trial:p.trial-1,
  candidate:p.candidate,loss:.5}),/stale_motor_proposal/);
 assert.throws(()=>feedback(state,{id,trial:p.trial,candidate:{f1:900,f2:1000},
  loss:.5}),/invalid_motor/);
}
assert.throws(()=>propose(state,'../../other'),/invalid_motif_id/);
assert.throws(()=>feedback(state,{id,trial:0,candidate:{f1:560,f2:1640},
 loss:NaN}),/invalid_motor_feedback/);
assert.throws(()=>validate({...state,records:[...state.records,state.records[0]]}),
 /invalid_motor_state/);
console.log('MIKOSHI_MOTORLINKS_OK bounded reward learns articulation, no audio storage');
