import {strict as assert} from 'node:assert';
import {track} from '../apps/mikoshi_tracking/tracker.mjs';
const blank=Array(192).fill(0);
function paint(x,color=0,y0=2){
 const pixels=[...blank];
 for(let y=y0;y<y0+2;y++)for(let col=x;col<x+2;col++)
  pixels[(y*8+col)*3+color]=1;
 return pixels;
}
function combine(a,b){
 return a.map((v,i)=>Math.max(v,b[i]));
}
const frames=[{timeMs:0,pixels:blank},
 {timeMs:200,pixels:combine(paint(1),paint(5,2,5))},
 {timeMs:400,pixels:combine(paint(2),paint(5,2,5))},
 {timeMs:600,pixels:combine(paint(3),paint(5,2,5))}];
const result=track(frames);
assert.equal(result.schema,'mikoshi.visual.tracks.v1');
assert.equal(result.tracks.length,2);
assert.equal(result.identityVerified,false);
const red=result.tracks.find(x=>x.path[0].x<4);
const blue=result.tracks.find(x=>x.path[0].x>4);
assert(red&&blue);
assert.equal(red.observations,3);
assert.deepEqual(red.path.map(x=>x.x),[1.5,2.5,3.5]);
assert.equal(blue.observations,3);
assert.deepEqual(blue.path.map(x=>x.x),[5.5,5.5,5.5]);
assert.equal(result.events.filter(x=>x.kind==='move').length,2);
assert(!JSON.stringify(result).includes('pixels'));
const none=track([{timeMs:0,pixels:blank},{timeMs:200,pixels:blank}]);
assert.equal(none.tracks.length,0);
assert.throws(()=>track([frames[0]]),/invalid_tracking_frames/);
assert.throws(()=>track([{timeMs:0,pixels:blank},
 {timeMs:0,pixels:blank}]),/invalid_tracking_frame/);
assert.throws(()=>track([{timeMs:0,pixels:blank},
 {timeMs:200,pixels:[...blank].fill(NaN)}]),/invalid_tracking_frame/);
assert.throws(()=>track(Array.from({length:13},(_,i)=>({
 timeMs:i*100,pixels:blank}))),/invalid_tracking_frames/);
console.log('MIKOSHI_TRACKING_OK stable anonymous blob tracks and bounded frames');
