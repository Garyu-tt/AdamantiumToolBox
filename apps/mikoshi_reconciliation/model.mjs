// Pure receipt reconciliation. Returns advice, never mutates other providers.
const ID=/^m[0-9]{5,7}$/,VISUAL=/^v[0-9]{5,7}$/;
export function assess(rows,expiresAt,now){
 if(!Array.isArray(rows)||rows.length<1||rows.length>12||
  !Number.isSafeInteger(now)||now<0||
  !Number.isSafeInteger(expiresAt)||expiresAt<0)
  throw Error('invalid_reconciliation_input');
 const observed=new Set(),expires=now>expiresAt;
 const results=rows.map(row=>{
  const {pairIndex,motif,grounding}=row||{};
  if(!Number.isInteger(pairIndex)||pairIndex<0||
   pairIndex>=rows.length||observed.has(pairIndex)||
   !motif||typeof motif.applied!=='boolean'||
   !grounding||typeof grounding.applied!=='boolean')
   throw Error('invalid_reconciliation_receipt');
  observed.add(pairIndex);
  const soundId=motif.result?.id;
  const linkSound=grounding.result?.soundId;
  const receipt=motif.result?.sourceReceipt;
  if(motif.applied&&(!ID.test(soundId)||typeof receipt!=='string'||
   receipt.length<20))throw Error('invalid_reconciliation_receipt');
  if(grounding.applied&&(!VISUAL.test(grounding.result?.visualId)||
   !ID.test(linkSound)))throw Error('invalid_reconciliation_receipt');
  let state='missing-both';
  if(motif.applied&&grounding.applied)
   state=linkSound===soundId?'complete':'inconsistent';
  else if(motif.applied)state='missing-link';
  else if(grounding.applied)state='inconsistent';
  const advice=state==='missing-link'&&!expires?
   'explicit-link-only':state==='complete'?'nothing':
   state==='inconsistent'?'quarantine-review':
   state==='missing-both'?'manual-reinspect':'expired-readonly';
  return {pairIndex,state,advice,soundId:motif.applied?soundId:null,
   visualId:grounding.applied?grounding.result.visualId:null,
   resumable:advice==='explicit-link-only'};
 });
 results.sort((a,b)=>a.pairIndex-b.pairIndex);
 const counts={complete:0,missingLink:0,missingBoth:0,inconsistent:0};
 for(const x of results){
  if(x.state==='complete')counts.complete++;
  else if(x.state==='missing-link')counts.missingLink++;
  else if(x.state==='missing-both')counts.missingBoth++;
  else counts.inconsistent++;
 }
 return {schema:'mikoshi.reconciliation.assessment.v1',rows:results,counts,
  expiresAt,writeWindowOpen:!expires,fullyApplied:counts.complete===rows.length,
  safeAutomaticWrites:false,rawMediaStored:false};
}
