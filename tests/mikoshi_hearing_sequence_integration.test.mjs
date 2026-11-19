import {strict as assert} from 'node:assert';
import {synth} from '../apps/mikoshi_phonetics/synth.mjs';
import {encode} from '../apps/mikoshi_motifs/encoder.mjs';
import {initialize as newMotifs,learn as hear,recognize} from
 '../apps/mikoshi_motifs/cluster.mjs';
import {initialize as newSequence,learn as observe,predict} from
 '../apps/mikoshi_sequences/model.mjs';
// An explicit test composition: production providers have no direct dependencies.
const soundA=synth({f1:810,f2:1290}),soundI=synth({f1:300,f2:2450});
let ear=newMotifs();
const a=hear(ear,encode(soundA).vector);ear=a.state;
const i=hear(ear,encode(soundI).vector);ear=i.state;
assert.notEqual(a.result.id,i.result.id,'different vowel spectra become different motifs');
const earA=recognize(ear,encode(soundA).vector);
const earI=recognize(ear,encode(soundI).vector);
assert(earA.matched&&earI.matched);
const events=[{id:earA.id,gapMs:0},{id:earI.id,gapMs:250},
 {id:earA.id,gapMs:300}];
const memory=observe(newSequence(),events);
assert(memory.result.updated);
const result=predict(memory.state,events.slice(0,2));
assert.equal(result.matchedOrder,2);
assert.equal(result.candidates[0].nextId,earA.id);
assert.equal(result.candidates[0].gapBand,'medium');
assert(!JSON.stringify(memory.state).includes('audioBase64'));
assert(!JSON.stringify(memory.state).includes('samples'));
console.log('MIKOSHI_HEAR_SEQUENCE_OK synthetic hearing -> stable IDs -> learned order');
