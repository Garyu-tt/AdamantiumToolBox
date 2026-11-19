import {strict as assert} from 'node:assert';
import {practice} from '../apps/mikoshi_classroom/loop_engine.js';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {spectrum,distance} from '../apps/mikoshi_phonetics/spectrum.mjs';
import {encode} from '../apps/mikoshi_motifs/encoder.mjs';
import {initialize as newMotif,learn as hear} from '../apps/mikoshi_motifs/cluster.mjs';
import {initialize as newMotor,propose as motorProposal,
 feedback as motorFeedback,catalog as motorCatalog} from '../apps/mikoshi_motorlinks/model.mjs';
import {initialize as newSequence,learn as sequenceLearn,catalog as sequenceCatalog} from
 '../apps/mikoshi_sequences/model.mjs';
import {initialize as newTransition,propose as transitionProposal,
 feedback as transitionFeedback,catalog as transitionCatalog} from
 '../apps/mikoshi_transitions/model.mjs';
import {plan} from '../apps/mikoshi_gestures/planner.mjs';
import {render,wav} from '../apps/mikoshi_vocalstream/renderer.mjs';
import {compare} from '../apps/mikoshi_audiometry/metric.mjs';
let motifs=newMotif(),motor=newMotor(),sequence=newSequence(),timing=newTransition();
let calls=0,mutations=0;
const skills={articulation:{preview:'ap',observe:'ao'},
 memory:{remember:'mr'},motor:{propose:'mp',feedback:'mf',status:'ms'},
 sequence:{teach:'st'},gesture:{plan:'gp'},wave:{render:'wr'},
 audiometry:{compare:'ac'},
 transition:{propose:'tp',feedback:'tf',status:'ts'}};
const api={async call(id,p){
 calls++;
 if(id==='ap')return {samples:synth(p.motor),sampleRate:12000};
 if(id==='ao')return {vector:spectrum(p.samples,p.sampleRate)};
 if(id==='mr'){
  assert.equal(p.sourceApproved,true);
  const v=hear(motifs,encode(p.samples,p.sampleRate).vector);
  motifs=v.state;mutations++;return v.result;
 }
 if(id==='mp')return motorProposal(motor,p.id);
 if(id==='mf'){
  assert.equal(p.sourceApproved,true);
  const v=motorFeedback(motor,p);motor=v.state;mutations++;return v.result;
 }
 if(id==='ms')return motorCatalog(motor);
 if(id==='st'){
  assert.equal(p.sourceApproved,true);
  const v=sequenceLearn(sequence,p.events);sequence=v.state;mutations++;return v.result;
 }
 if(id==='gp')return plan(p.steps,p.transitionMs);
 if(id==='wr')return {mime:'audio/wav',audioBase64:wav(render(p.trajectory))};
 if(id==='ac')return compare(p.reference,p.candidate);
 if(id==='tp')return transitionProposal(timing,p.from,p.to);
 if(id==='tf'){
  assert.equal(p.sourceApproved,true);
  const v=transitionFeedback(timing,p);timing=v.state;mutations++;return v.result;
 }
 if(id==='ts')return transitionCatalog(timing);
 throw Error('unadvertised_action '+id);
}};
let progress=[];
const result=await practice(api,skills,s=>progress.push(s));
assert.equal(result.schema,'mikoshi.learning.loop.v1');
assert.equal(result.languageModel,false);
assert.equal(result.motifs.length,2);
assert.notEqual(result.motifs[0],result.motifs[1]);
assert.equal(sequenceCatalog(sequence).episodes,1);
assert.equal(motorCatalog(motor).records.length,2);
assert(motorCatalog(motor).records.every(r=>r.trials===8));
assert.equal(transitionCatalog(timing).pairs[0].trials,7);
assert.equal(result.transitionMs,120);
assert.equal(result.transitionLoss,0);
assert.equal(Buffer.from(result.audioBase64,'base64').subarray(0,4).toString(),'RIFF');
assert(mutations>=26);assert(calls>=65);assert(progress.length>10);
const before=mutations;
await assert.rejects(practice(api,skills,()=>{},()=>true),/practice_cancelled/);
assert.equal(mutations,before,'cancelled session does not mutate memory');
await assert.rejects(practice(api,{articulation:{preview:'ap'}}),
 /missing_capability_memory_remember/);
console.log('MIKOSHI_COMPLETE_LOOP_OK audible stimulus -> memory -> motor -> timing -> waveform');
