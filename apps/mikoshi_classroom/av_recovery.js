import {verifyLesson} from './av_policy.js';
// Read back committed writes, never infer success from a timed-out request.
export async function inspectRecovery(api,actions,signed,count){
 if(!signed||!Number.isInteger(count)||count<1||count>12||
  typeof actions?.reconcile!=='string'||!Number.isSafeInteger(signed.expiresAt)||
  typeof actions?.motifReceipt!=='string'||
  typeof actions?.groundingReceipt!=='string')
  throw Error('reconciliation_capability_unavailable');
 const pairs=[];
 for(let pairIndex=0;pairIndex<count;pairIndex++){
  const proof={sourcePermit:signed.token,
   lessonDigest:signed.digest,pairIndex};
  const [motif,grounding]=await Promise.all([
   api.call(actions.motifReceipt,proof),
   api.call(actions.groundingReceipt,proof)]);
  pairs.push({pairIndex,motif,grounding});
 }
 const assessment=await api.call(actions.reconcile,{rows:pairs,
  expiresAt:signed.expiresAt});
 if(assessment?.schema!=='mikoshi.reconciliation.assessment.v1'||
  assessment.rows?.length!==count||assessment.safeAutomaticWrites!==false)
  throw Error('invalid_reconciliation_assessment');
 return {assessment,pairs};
}
export async function resumeMissingLinks(api,actions,lesson,signed){
 const {assessment,pairs}=await inspectRecovery(
  api,actions,signed,lesson?.length);
 if(assessment.counts.inconsistent>0||
  assessment.counts.missingBoth>0||
  assessment.rows.some(r=>r.state==='missing-link'&&!r.resumable))
  throw Error('reconciliation_requires_manual_review');
 const pending=assessment.rows.filter(r=>r.state==='missing-link');
 if(!pending.length)return {resumed:0,completed:assessment.fullyApplied};
 let resumed=0;
 for(const row of pending){
  if(Date.now()+2000>=signed.expiresAt)
   throw Error('reconciliation_write_window_closed');
  await verifyLesson(api,actions.policy,lesson,signed);
  const {pairIndex}=row;
  const motif=pairs[pairIndex]?.motif?.result;
  const entry=lesson[pairIndex];
  if(!motif?.sourceReceipt||!motif.id||!entry?.visual?.vector)
   throw Error('missing_verified_audio_receipt');
  const {visual,pair}=entry;
  await api.call(actions.teach,{
   visualVector:visual.vector,soundId:motif.id,
   visualAtMs:pair.visualAtMs,soundAtMs:pair.soundAtMs,
   sourceApproved:true,sourcePermit:signed.token,
   lessonDigest:signed.digest,pairIndex,
   motifReceipt:motif.sourceReceipt});
  resumed++;
 }
 const checked=await inspectRecovery(api,actions,signed,lesson.length);
 return {resumed,completed:checked.assessment.fullyApplied,
  counts:checked.assessment.counts};
}
