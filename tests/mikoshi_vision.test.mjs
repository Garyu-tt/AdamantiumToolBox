import {strict as assert} from 'node:assert';
import {analyze} from '../apps/mikoshi_vision/encoder.mjs';
const blank=Array(192).fill(0);
function square(color,intensity=1){
 const pixels=[...blank];
 for(let y=2;y<5;y++)for(let x=2;x<5;x++)
  pixels[(y*8+x)*3+color]=intensity;
 return pixels;
}
const frames=[{timeMs:0,pixels:blank},
 {timeMs:200,pixels:square(0)},
 {timeMs:400,pixels:blank},
 {timeMs:600,pixels:square(2)}];
const r=analyze(frames);
assert.equal(r.schema,'mikoshi.visual.events.v1');
assert.equal(r.detected,3);
assert.deepEqual(r.events.map(x=>x.kind),['appear','disappear','appear']);
assert.deepEqual(r.events.map(x=>x.timeMs),[200,400,600]);
assert.equal(r.events[0].vector.length,10);
assert(r.events.every(e=>e.vector.every(x=>x>=0&&x<=1)));
assert.notDeepEqual(r.events[0].vector,r.events[2].vector);
const dim=analyze([{timeMs:0,pixels:blank},{timeMs:200,pixels:blank}]);
assert.equal(dim.detected,0);
const dimmer=analyze([{timeMs:0,pixels:blank},
 {timeMs:200,pixels:square(0,.9)}]);
assert.equal(dimmer.detected,1);
assert.throws(()=>analyze(frames.slice(0,1)),/invalid_visual_stream/);
assert.throws(()=>analyze([{timeMs:0,pixels:blank},
 {timeMs:0,pixels:square(0)}]),/invalid_visual_timeline/);
assert.throws(()=>analyze([{timeMs:0,pixels:blank},
 {timeMs:200,pixels:Array(192).fill(NaN)}]),/invalid_visual_frame/);
assert.throws(()=>analyze([{timeMs:0,pixels:blank},
 {timeMs:200,pixels:Array(200).fill(0)}]),/invalid_visual_frame/);
assert(!JSON.stringify(r).includes('pixels'),'no raw frame data in output');
console.log('MIKOSHI_VISION_OK visual changes, anonymous events, input rejection');
