import {strict as assert} from 'node:assert';
import {segment} from '../apps/mikoshi_segments/segmenter.mjs';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {spectrum} from '../apps/mikoshi_phonetics/spectrum.mjs';
import {encode} from '../apps/mikoshi_motifs/encoder.mjs';
import {initialize as newMotifs,learn as hear} from '../apps/mikoshi_motifs/cluster.mjs';
import {initialize as newMotor,propose,feedback,catalog} from
 '../apps/mikoshi_motorlinks/model.mjs';
import {plan} from '../apps/mikoshi_gestures/planner.mjs';
import {render,wav} from '../apps/mikoshi_vocalstream/renderer.mjs';
import {imitateEvents} from '../apps/mikoshi_classroom/stream_imitation.js';
const a=synth({f1:810,f2:1290}),i=synth({f1:300,f2:2450});
const observed=segment([...Array(2400).fill(0),...a,...Array(1200).fill(0),
 ...i,...Array(2400).fill(0)]);
assert.equal(observed.detected,2);
let motifs=newMotifs(),motor=newMotor(),writes=0;
const lesson=[];
for(const event of observed.events){
 const res=hear(motifs,encode(event.samples).vector);
 motifs=res.state;lesson.push({...event,id:res.result.id});
}
assert.notEqual(lesson[0].id,lesson[1].id);
const roles={articulation:{preview:'preview',observe:'observe'},
 motor:{propose:'propose',feedback:'feedback',status:'status'},
 gesture:{plan:'plan'},wave:{render:'render'}};
const api={async call(action,params){
 if(action==='preview')return {samples:synth(params.motor),sampleRate:12000};
 if(action==='observe')return {vector:spectrum(params.samples)};
 if(action==='propose')return propose(motor,params.id);
 if(action==='feedback'){
  assert.equal(params.sourceApproved,true);
  const update=feedback(motor,params);motor=update.state;writes++;return update.result;
 }
 if(action==='status')return catalog(motor);
 if(action==='plan')return plan(params.steps,params.transitionMs);
 if(action==='render')return {mime:'audio/wav',
  audioBase64:wav(render(params.trajectory)),durationMs:params.trajectory.durationMs};
 throw Error('unrecognized_skill_'+action);
}};
await assert.rejects(imitateEvents(api,{articulation:{observe:'observe'}},lesson),
 /missing_capability_articulation_preview/);
assert.equal(writes,0,'missing capability must be denied before writes');
let progress=[];
const result=await imitateEvents(api,roles,lesson,s=>progress.push(s));
assert.equal(result.schema,'mikoshi.stream.imitation.v1');
assert.equal(result.languageModel,false);
assert.equal(result.events,2);
assert.equal(result.durationMs,500);
assert.equal(Buffer.from(result.audioBase64,'base64').toString('ascii',0,4),'RIFF');
assert.equal(writes,12);
assert.equal(catalog(motor).records.length,2);
assert.equal(progress.length,12);
assert.throws(()=>lesson[0].samples.some(x=>!Number.isFinite(x)),undefined);
console.log('MIKOSHI_STREAM_IMITATION_OK audio events -> learned motor -> continuous vocal WAV');
