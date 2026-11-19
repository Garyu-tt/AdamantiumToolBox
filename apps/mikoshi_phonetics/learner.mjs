import {motors,synth} from './synth.mjs';
import {spectrum,distance} from './spectrum.mjs';
export function initialize(pitch=235){
 if(!Number.isFinite(pitch)||pitch<170||pitch>340)throw Error('pitch_anchor');
 return {schema:'mikoshi.phonetics.v1',anchorHz:pitch,
  motor:{f1:560,f2:1640},lessons:0,improvements:0,lastLoss:null};
}
function checked(state){
 if(!state||state.schema!=='mikoshi.phonetics.v1'||
  !Number.isFinite(state.anchorHz)||state.anchorHz<170||state.anchorHz>340||
  !Number.isSafeInteger(state.lessons)||state.lessons<0||
  !Number.isSafeInteger(state.improvements)||state.improvements<0||
  (state.lastLoss!==null&&(!Number.isFinite(state.lastLoss)||state.lastLoss<0)))
  throw Error('invalid_learning_state');
 motors(state.motor);
}
export function evaluate(state,reference,rate=12000){
 checked(state);const target=spectrum(reference,rate);
 const produced=spectrum(synth(state.motor,state.anchorHz));
 return {loss:distance(target,produced),target};
}
export function imitate(state,reference,rate=12000){
 checked(state);
 const next=structuredClone(state);
 const {target}=evaluate(next,reference,rate);
 const fitness=m=>distance(target,spectrum(synth(m,next.anchorHz)));
 let best=motors(next.motor),initial=fitness(best),loss=initial;
 // Fixed bounded search; no hidden model, pretrained table or remote inference.
 for(const [step1,step2] of [[180,420],[100,240],[55,135],[28,70],[14,35]]){
  let candidate=best,candidateLoss=loss;
  for(const da of [-1,0,1])for(const db of [-1,0,1]){
   if(da===0&&db===0)continue;
   const m={f1:Math.max(250,Math.min(1050,best.f1+da*step1)),
    f2:Math.max(900,Math.min(3300,best.f2+db*step2))};
   if(m.f2-m.f1<400)continue;
   const e=fitness(m);
   if(e+1e-10<candidateLoss){candidate=m;candidateLoss=e;}
  }
  best=candidate;loss=candidateLoss;
 }
 next.motor=best;next.lessons++;
 if(loss+1e-8<initial)next.improvements++;
 next.lastLoss=+loss.toFixed(8);
 return {state:next,result:{before:+initial.toFixed(8),
  after:next.lastLoss,improved:loss+1e-8<initial,
  motor:best,anchorHz:next.anchorHz}};
}
