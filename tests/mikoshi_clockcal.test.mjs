import {strict as assert} from 'node:assert';
import {calibrate,shiftAudio} from '../apps/mikoshi_clockcal/calibrate.mjs';
const cues=[[100,170],[600,672],[1000,1068],[1600,1672]].map(
 ([visualAtMs,audioAtMs])=>({visualAtMs,audioAtMs,knownCommonStimulus:true}));
const result=calibrate(cues,12);
assert.equal(result.schema,'mikoshi.clockcal.estimate.v1');
assert.equal(result.offsetMs,72);
assert(result.usable);
assert.equal(result.hardwareCalibrated,false);
assert(result.uncertaintyMs<=30);
const shifted=shiftAudio([{timeMs:272},{timeMs:672}],result);
assert.deepEqual(shifted.audioEvents,[{timeMs:200},{timeMs:600}]);
assert.equal(shifted.attested,false);
const unstable=calibrate(cues.map((e,i)=>({
 ...e,audioAtMs:e.audioAtMs+(i%2?130:0)})));
assert.equal(unstable.usable,false);
assert.throws(()=>shiftAudio([{timeMs:100}],unstable),
 /unusable_clock_calibration/);
assert.throws(()=>calibrate(cues.slice(0,2)),/invalid_calibration_cues/);
assert.throws(()=>calibrate(cues.map(x=>({
 ...x,knownCommonStimulus:false}))),/unverified_calibration_cue/);
assert.throws(()=>calibrate(cues.map(x=>({...x,audioAtMs:100}))),
 /unverified_calibration_cue/);
console.log('MIKOSHI_CLOCKCAL_OK known-cue offset, unstable rejection, no hardware claim');
