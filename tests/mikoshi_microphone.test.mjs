import {strict as assert} from 'node:assert';
import {lessonPcm} from '../apps/mikoshi_classroom/pcm.js';
const rate=48000,pitch=235;
const source=Float32Array.from({length:rate},(_,i)=>
 Math.sin(2*Math.PI*pitch*i/rate)*.3);
const pcm=lessonPcm(source,rate);
assert.equal(pcm.length,2400);
assert(pcm.every(x=>Number.isFinite(x)&&Math.abs(x)<=1));
let rms=0;for(const x of pcm)rms+=x*x;
assert(Math.sqrt(rms/pcm.length)>.1);
assert.throws(()=>lessonPcm(Float32Array.from({length:48000},()=>0),48000),
 /microphone_sample_too_quiet/);
assert.throws(()=>lessonPcm([],48000),/invalid_microphone_audio/);
assert.throws(()=>lessonPcm(source,100),/invalid_microphone_audio/);
console.log('MIKOSHI_MIC_PCM_OK bounded resampling and silence rejection');
