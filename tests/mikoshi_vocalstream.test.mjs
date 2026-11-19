import {strict as assert} from 'node:assert';
import {plan} from '../apps/mikoshi_gestures/planner.mjs';
import {render,wav,anchor,validate,RATE,FRAME_SAMPLES} from
 '../apps/mikoshi_vocalstream/renderer.mjs';
const A={f1:810,f2:1290},I={f1:300,f2:2450};
const trajectory=plan([{motor:A,durationMs:240},{motor:I,durationMs:260}]);
const source=structuredClone(trajectory);
const samples=render(trajectory,235);
assert.equal(samples.length,trajectory.frames.length*FRAME_SAMPLES);
assert.equal(samples.length,6000);assert.equal(RATE,12000);
assert(samples.every(x=>Number.isFinite(x)&&Math.abs(x)<=.681));
assert(samples.some(x=>Math.abs(x)>.2),'should produce audible waveform');
assert.deepEqual(trajectory,source,'synthesis must not alter motor plan');
assert.deepEqual(samples,render(trajectory,235),'rendering is deterministic');
const bytes=Buffer.from(wav(samples),'base64');
assert.equal(bytes.subarray(0,4).toString(),'RIFF');
assert.equal(bytes.subarray(8,12).toString(),'WAVE');
assert.equal(bytes.readUInt32LE(24),12000);
assert.equal(bytes.readUInt32LE(40),samples.length*2);
assert.equal(bytes.length,44+samples.length*2);
assert.equal(anchor(),235);
// A renderer must NOT restart the sinusoidal phase every 10 ms.
const at=24*FRAME_SAMPLES;
const seam=Math.abs(samples[at]-samples[at-1]);
const local=Array.from({length:100},(_,n)=>
 Math.abs(samples[at-50+n+1]-samples[at-50+n]));
assert(seam<=Math.max(...local)+1e-8,'boundary click must not exceed local slope');
const pause=plan([{motor:A,durationMs:180,pauseMs:200},
 {motor:I,durationMs:180}]);
const paused=render(pause);
const quiet=paused.slice(2400,4350); // central pause, excluding fade boundaries
const rms=Math.sqrt(quiet.reduce((v,x)=>v+x*x,0)/quiet.length);
assert(rms<.04,'explicit pause should be nearly silent');
const tampered={...trajectory,frames:[...trajectory.frames]};
tampered.frames[0]={...tampered.frames[0],f1:-1};
assert.throws(()=>render(tampered),/invalid_vocal_frame/);
assert.throws(()=>render({...trajectory,durationMs:1}),/invalid_vocal_trajectory/);
assert.throws(()=>render(trajectory,500),/vocal_anchor_invalid/);
assert.throws(()=>wav(Array(100).fill(0)),/invalid_vocal_audio/);
console.log('MIKOSHI_VOCALSTREAM_OK phase-consistent WAV, pause, motor validation');
