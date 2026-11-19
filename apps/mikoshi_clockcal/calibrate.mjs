// Numeric offset estimate from EXPLICIT known common calibration cues.
// Observing coincident arbitrary events cannot validate clock alignment.
const median=v=>{const x=[...v].sort((a,b)=>a-b);return x[Math.floor(x.length/2)];};
export function calibrate(cues,referenceUncertaintyMs=0){
 if(!Array.isArray(cues)||cues.length<3||cues.length>12||
  !Number.isInteger(referenceUncertaintyMs)||referenceUncertaintyMs<0||
  referenceUncertaintyMs>200)
  throw Error('invalid_calibration_cues');
 let lastVisual=-1,lastAudio=-1;
 const offsets=[];
 for(const cue of cues){
  if(!cue||cue.knownCommonStimulus!==true||
   !Number.isInteger(cue.visualAtMs)||!Number.isInteger(cue.audioAtMs)||
   cue.visualAtMs<0||cue.audioAtMs<0||
   cue.visualAtMs>4000||cue.audioAtMs>4000||
   cue.visualAtMs<=lastVisual||cue.audioAtMs<=lastAudio)
   throw Error('unverified_calibration_cue');
  offsets.push(cue.audioAtMs-cue.visualAtMs);
  lastVisual=cue.visualAtMs;lastAudio=cue.audioAtMs;
 }
 const offset=median(offsets),errors=offsets.map(x=>Math.abs(x-offset));
 const mad=median(errors),maxError=Math.max(...errors);
 const uncertainty=Math.ceil(Math.max(mad*2,maxError)+referenceUncertaintyMs);
 const usable=uncertainty<=80&&Math.abs(offset)<=400;
 return {schema:'mikoshi.clockcal.estimate.v1',
  usable,offsetMs:offset,uncertaintyMs:uncertainty,
  cues:cues.length,residualMadMs:mad,maxResidualMs:maxError,
  reason:usable?'bounded_known_cue_offset':'unstable_or_excessive_offset',
  attested:false,operatorClaimsKnownStimulus:true,hardwareCalibrated:false};
}
export function shiftAudio(events,calibration){
 if(!calibration||calibration.schema!=='mikoshi.clockcal.estimate.v1'||
  !calibration.usable||!Number.isInteger(calibration.offsetMs)||
  !Number.isInteger(calibration.uncertaintyMs))
  throw Error('unusable_clock_calibration');
 if(!Array.isArray(events)||events.length>12)throw Error('invalid_audio_events');
 const corrected=events.map(e=>{
  if(!e||!Number.isInteger(e.timeMs)||e.timeMs<0||e.timeMs>4000)
   throw Error('invalid_audio_event');
  const timeMs=e.timeMs-calibration.offsetMs;
  if(timeMs<0||timeMs>4000)throw Error('calibrated_time_out_of_range');
  return {timeMs};
 });
 return {schema:'mikoshi.clockcal.shifted.v1',
  audioEvents:corrected,uncertaintyMs:calibration.uncertaintyMs,
  attested:false};
}
