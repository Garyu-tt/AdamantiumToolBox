import {strict as assert} from 'node:assert';
import {plan} from '../apps/mikoshi_gestures/planner.mjs';
import {render,wav} from '../apps/mikoshi_vocalstream/renderer.mjs';
import {compare,decode} from '../apps/mikoshi_audiometry/metric.mjs';
import {initialize,propose,feedback,catalog} from '../apps/mikoshi_transitions/model.mjs';
const A={f1:810,f2:1290},I={f1:300,f2:2450};
const steps=[{motor:A,durationMs:240},{motor:I,durationMs:260}];
const teacher=wav(render(plan(steps,140))),copy=teacher;
const loss=ms=>compare(teacher,wav(render(plan(steps,ms)))).loss;
assert.equal(decode(teacher).length,6000);
assert.equal(compare(teacher,copy).loss,0);
assert(loss(80)>0,'different coarticulation should alter sound');
let state=initialize(),initial=structuredClone(state),last=Infinity;
let all=[];
for(let i=0;i<7;i++){
 const next=propose(state,'m00001','m00002');
 assert(next.ready);const d=loss(next.transitionMs);all.push({ms:next.transitionMs,loss:d});
 const r=feedback(state,{from:next.from,to:next.to,trials:next.trials,
  transitionMs:next.transitionMs,loss:d});
 assert(r.result.bestLoss<=last+1e-8);
 last=r.result.bestLoss;state=r.state;
}
assert.equal(all.find(x=>x.ms===140).loss,0);
assert.equal(propose(state,'m00001','m00002').ready,false);
assert.equal(catalog(state).pairs[0].bestMs,140);
assert.equal(catalog(state).pairs[0].bestLoss,0);
assert.deepEqual(initial,initialize());
assert.equal(propose(state,'m00002','m00001').ready,true,'directional motor memory');
const stale={from:'m00001',to:'m00002',trials:0,transitionMs:80,loss:.1};
assert.throws(()=>feedback(state,stale),/stale_transition_proposal/);
assert.throws(()=>propose(state,'../../etc','m00002'),/invalid_motif_pair/);
assert.throws(()=>feedback(initialize(),{...stale,loss:-1}),/invalid_transition_reward/);
assert.throws(()=>compare('invalid','invalid'),/invalid_wave_encoding/);
assert.throws(()=>compare(teacher,wav(render(plan([
 {motor:A,durationMs:200},{motor:I,durationMs:260}],140)))),
 /unaligned_audio_duration/);
const silent=Buffer.from(teacher,'base64');
for(let i=44;i<silent.length;i++)silent[i]=0;
assert.throws(()=>compare(silent.toString('base64'),teacher),/silent_audio/);
console.log('MIKOSHI_TRANSITION_FEEDBACK_OK audio reward learns an unseen transition');
