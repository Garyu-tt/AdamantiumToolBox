import {strict as assert} from 'node:assert';
import {plan,motor,validate} from '../apps/mikoshi_gestures/planner.mjs';
const A={f1:810,f2:1290},I={f1:300,f2:2450},U={f1:420,f2:1030};
const steps=[{motor:A,durationMs:240},{motor:I,durationMs:260}];
const p=plan(steps);
assert.equal(p.schema,'mikoshi.gesture.frames.v1');
assert.equal(p.durationMs,500);assert.equal(p.frames.length,50);
assert.deepEqual(p.frames[0],{...A,voiced:true});
assert.deepEqual(p.frames[23],{...I,voiced:true});
assert.deepEqual(p.frames[24],{...I,voiced:true});
assert.deepEqual(p.frames.at(-1),{...I,voiced:true});
for(let j=17;j<=23;j++){
 assert(p.frames[j].f1<=p.frames[j-1].f1);
 assert(p.frames[j].f2>=p.frames[j-1].f2);
 assert(p.frames[j].f2-p.frames[j].f1>=400);
}
assert.deepEqual(p.frames.slice(0,16),
 Array.from({length:16},()=>({...A,voiced:true})));
assert.equal(steps[0].pauseMs,undefined,'planner must not mutate caller');
const pause=plan([{motor:A,durationMs:180,pauseMs:150},
 {motor:U,durationMs:180,pauseMs:0}]);
assert.equal(pause.durationMs,510);
assert.equal(pause.frames.length,51);
assert(pause.frames.slice(18,33).every(f=>f.voiced===false));
assert.deepEqual(pause.frames[33],{...U,voiced:true});
const three=plan([{motor:A,durationMs:120},{motor:I,durationMs:120},
 {motor:U,durationMs:120}]);
assert.equal(three.segments,3);
assert(three.frames.every(f=>f.f2-f.f1>=400));
assert.throws(()=>motor({f1:850,f2:1000}),/invalid_vocal_motor/);
assert.throws(()=>validate([steps[0]]),/invalid_gesture_plan/);
assert.throws(()=>plan([{motor:A,durationMs:123},steps[1]]),/invalid_gesture_step/);
assert.throws(()=>plan([{motor:A,durationMs:120,pauseMs:111},steps[1]]),
 /invalid_gesture_step/);
assert.throws(()=>plan([steps[0],{...steps[1],pauseMs:50}]),/invalid_gesture_step/);
assert.throws(()=>plan(Array.from({length:7},()=>steps[0])),/invalid_gesture_plan/);
assert.throws(()=>plan(steps,30),/invalid_gesture_plan/);
console.log('MIKOSHI_GESTURES_OK continuous formant motion, bounded rhythm, pauses');
