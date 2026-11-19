import {strict as assert} from 'node:assert';
import {align} from '../apps/mikoshi_avsync/align.mjs';
const visual=[{timeMs:200,kind:'appear'},{timeMs:400,kind:'disappear'},
 {timeMs:600,kind:'appear'}];
const sound=[{timeMs:210},{timeMs:610}];
const paired=align(visual,sound,160);
assert.equal(paired.schema,'mikoshi.avsync.alignment.v1');
assert.equal(paired.matches.length,2);
assert.equal(paired.considered,2);
assert.deepEqual(paired.matches.map(e=>e.visualIndex),[0,2]);
assert.deepEqual(paired.matches.map(e=>e.audioIndex),[0,1]);
assert.equal(paired.certified,false);
assert.equal(paired.automaticLearning,false);
assert(!JSON.stringify(paired).includes('samples'));
assert.equal(align(visual,sound,230).matches.length,2);
assert.equal(align(visual,sound,245).matches.length,0);
const crowded=align([{timeMs:200,kind:'appear'}],
 [{timeMs:190},{timeMs:220}],160);
assert.equal(crowded.matches.length,0);
assert.equal(crowded.unpaired[0].reason,'ambiguous_audio_nearby');
const shared=align([{timeMs:190,kind:'appear'},
 {timeMs:220,kind:'appear'}],[{timeMs:200}],160);
assert.equal(shared.matches.length,0);
assert(shared.unpaired.every(p=>p.reason==='audio_shared_by_events'));
const far=align([{timeMs:200,kind:'appear'}],[{timeMs:800}],100);
assert.equal(far.matches.length,0);
assert.equal(far.unpaired[0].reason,'no_audio_within_window');
assert.throws(()=>align(visual,sound,251),/invalid_av_timeline/);
assert.throws(()=>align([{timeMs:200,kind:'appear'},
 {timeMs:100,kind:'appear'}],sound,20),/invalid_av_timeline/);
assert.throws(()=>align([{timeMs:200,kind:'untrusted'}],sound,20),
 /invalid_av_timeline/);
assert.throws(()=>align(visual,[{timeMs:200},{timeMs:200}],20),
 /invalid_av_timeline/);
console.log('MIKOSHI_AVSYNC_OK strict time bounds, ambiguity abstention, no raw data');
