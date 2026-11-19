// Coarticulation trajectory: smooth formant motion, no audio or language model.
const FRAME_MS=10,MAX_FRAMES=360;
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
export function motor(v){
 if(!v||!int(v.f1,250,1050)||!int(v.f2,900,3300)||v.f2-v.f1<400)
  throw Error('invalid_vocal_motor');
 return {f1:v.f1,f2:v.f2};
}
export function validate(steps,transitionMs=80){
 if(!Array.isArray(steps)||steps.length<2||steps.length>6||
  !int(transitionMs,40,160)||transitionMs%FRAME_MS)
  throw Error('invalid_gesture_plan');
 let duration=0;
 for(let i=0;i<steps.length;i++){
  const s=steps[i];motor(s?.motor);
  if(!int(s?.durationMs,120,600)||s.durationMs%FRAME_MS||
   !int(s?.pauseMs??0,0,200)||(s.pauseMs??0)%FRAME_MS||
   (i===steps.length-1&&(s.pauseMs??0)!==0))
   throw Error('invalid_gesture_step');
  duration+=s.durationMs+(s.pauseMs??0);
 }
 if(duration/FRAME_MS>MAX_FRAMES)throw Error('gesture_duration_limit');
 return duration;
}
const smooth=t=>t*t*t*(t*(t*6-15)+10);
export function plan(steps,transitionMs=80){
 const durationMs=validate(steps,transitionMs),frames=[];
 for(let i=0;i<steps.length;i++){
  const s=steps[i],now=motor(s.motor),next=steps[i+1]&&motor(steps[i+1].motor);
  const count=s.durationMs/FRAME_MS;
  const fade=next&&!(s.pauseMs??0)?Math.min(count,transitionMs/FRAME_MS):0;
  for(let n=0;n<count;n++){
   const t=fade&&n>=count-fade?smooth((n-(count-fade)+1)/fade):0;
   const m={f1:Math.round(now.f1+(next?next.f1-now.f1:0)*t),
    f2:Math.round(now.f2+(next?next.f2-now.f2:0)*t)};
   frames.push({...m,voiced:true});
  }
  for(let p=0;p<(s.pauseMs??0)/FRAME_MS;p++)
   frames.push({...now,voiced:false});
 }
 if(frames.length*FRAME_MS!==durationMs)throw Error('gesture_internal_duration');
 return {schema:'mikoshi.gesture.frames.v1',frameMs:FRAME_MS,durationMs,
  segments:steps.length,frames};
}
