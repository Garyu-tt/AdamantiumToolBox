import {strict as assert} from 'node:assert';
import {encode,distance} from '../apps/mikoshi_motifs/encoder.mjs';
import {initialize,learn,recognize,catalog} from '../apps/mikoshi_motifs/cluster.mjs';
// Synthetic harmonic vowels are controlled stimuli, not a claim of natural ASR.
function vowel(f1,f2,gain=1,phase=0){
 const pitch=235,rate=12000,terms=[];
 for(let k=1;k*pitch<4400;k++){
  const hz=k*pitch,a=Math.exp(-.5*((hz-f1)/145)**2);
  const b=Math.exp(-.5*((hz-f2)/245)**2);
  terms.push({hz,amp:(.08+3*a+2.6*b+.45*Math.exp(-.5*((hz-3050)/450)**2))/k**.72});
 }
 const pcm=Array(2400).fill(0);let peak=0;
 for(let i=0;i<2400;i++){
  const edge=Math.min(1,i/130,(2399-i)/130);let v=0;
  for(const t of terms)v+=Math.sin(2*Math.PI*t.hz*i/rate+phase)*t.amp;
  pcm[i]=v*edge;peak=Math.max(peak,Math.abs(pcm[i]));
 }
 return pcm.map(v=>v/peak*.55*gain);
}
const a=vowel(810,1290),again=vowel(810,1290,.6,1.2),i=vowel(300,2450);
const fa=encode(a),fb=encode(again),fi=encode(i);
assert.equal(fa.vector.length,22);
assert(distance(fa.vector,fb.vector)<.005);
assert(distance(fa.vector,fi.vector)>.15);
const empty=initialize();
assert.equal(recognize(empty,fa.vector).id,null);
const first=learn(empty,fa.vector),second=learn(first.state,fb.vector);
assert.equal(first.result.kind,'discovered');
assert.equal(second.result.kind,'reinforced');
assert.equal(second.result.id,first.result.id);
assert.equal(second.state.units.length,1);
assert.equal(recognize(second.state,fa.vector).id,first.result.id);
assert.equal(recognize(second.state,fi.vector).id,null);
const third=learn(second.state,fi.vector);
assert.equal(third.result.kind,'discovered');
assert.notEqual(third.result.id,first.result.id);
assert.equal(catalog(third.state).units.length,2);
assert.equal(empty.units.length,0);
assert(!JSON.stringify(third.state).includes('samples'));
assert.throws(()=>encode(Array(2400).fill(0)),/silent_audio_frame/);
assert.throws(()=>encode(Array(2400).fill(2)),/invalid_audio_frame/);
assert.throws(()=>learn(initialize(),[NaN,...fa.vector.slice(1)]),/invalid_auditory_vector/);
assert.throws(()=>catalog({...third.state,units:[...third.state.units,third.state.units[0]]}),/duplicate_motif_id/);
console.log('MIKOSHI_MOTIFS_OK novelty discovery, reinforcement, different sounds, bounded audio');
