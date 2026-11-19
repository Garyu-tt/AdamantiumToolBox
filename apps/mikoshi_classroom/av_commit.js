import {permitLesson,verifyLesson} from './av_policy.js';
// Pure composition over authorized MAS actions; no direct service dependencies.
export async function commitAV(api,actions,lesson,durationMs,onPermit=()=>{}){
 const signed=await permitLesson(api,actions.policy,lesson,durationMs);
 onPermit(signed);
 let saved=0;const relations=[];
 try{
  for(const [pairIndex,{visual,audio,pair}] of lesson.entries()){
   await verifyLesson(api,actions.policy,lesson,signed);
   const receipt=await api.call(actions.remember,{
    samples:audio.samples,sampleRate:12000,sourceApproved:true,
    sourcePermit:signed.token,lessonDigest:signed.digest,pairIndex});
   const relation=await api.call(actions.teach,{
    visualVector:visual.vector,soundId:receipt.id,
    visualAtMs:pair.visualAtMs,soundAtMs:pair.soundAtMs,
    sourceApproved:true,sourcePermit:signed.token,
    lessonDigest:signed.digest,pairIndex,
    motifReceipt:receipt.sourceReceipt});
   saved++;relations.push({visualId:relation.visualId,soundId:receipt.id});
  }
  return {saved,relations};
 }catch(error){
  // The first service may have committed despite a lost HTTP response.
  throw Error('ambiguous_av_commit: '+String(error.message||error));
 }
}
export async function inspectAV(api,actions,signed,count){
 if(!signed||!Number.isInteger(count)||count<1||count>12||
  typeof actions?.motifReceipt!=='string'||
  typeof actions?.groundingReceipt!=='string')
  throw Error('readback_unavailable');
 const rows=[];
 for(let pairIndex=0;pairIndex<count;pairIndex++){
  const params={sourcePermit:signed.token,lessonDigest:signed.digest,pairIndex};
  const audio=await api.call(actions.motifReceipt,params);
  const visual=await api.call(actions.groundingReceipt,params);
  rows.push({pairIndex,motif:audio.applied,grounding:visual.applied,
   soundId:audio.result?.id??null,visualId:visual.result?.visualId??null});
 }
 return rows;
}
