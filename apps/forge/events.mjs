// Forge R03: stateless external event projection, with external cursor and no side effects.
import {prepareReconciliation,validateIncident} from './pipeline.mjs';
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const token=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const ref=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
const triggers=new Set(['dependency.changed','provider.revoked','verification.failed',
 'permission.changed','artifact.changed','contract.changed']);
const kinds=new Set([...triggers,'function.verified','function.published',
 'function.invalidated','ui.contribution.changed','incident.detected','incident.remediation_attempted']);
const err=(code,reason,path,fix)=>({code,reason,evidence:{path},impact:'Projection cannot be trusted',
 remedies:[{action:fix,safety:'external-authorization-required'}]});
const fail=errors=>({ok:false,projected:false,executed:false,errors});
export function projectEvents(p){
 if(!isObj(p)||p.schema!=='forge.events.batch.v1'||!token(p.stream_id)||
    !isObj(p.cursor)||p.cursor.stream_id!==p.stream_id||
    !Number.isSafeInteger(p.cursor.sequence)||p.cursor.sequence<0||
    !token(p.cursor.revision)||!Array.isArray(p.events)||p.events.length===0||p.events.length>256)
  return fail([err('BAD_BATCH','Stream, external cursor and 1..256 events required','$','refresh-external-event-cursor')]);
 const issues=[];let next=p.cursor.sequence;const actions=[],seen=new Set();
 for(const [i,event] of p.events.entries()){
  const path=`events[${i}]`;
  if(!isObj(event)||event.schema!=='forge.event.v1'||!token(event.id)||!kinds.has(event.type)||
     !Number.isSafeInteger(event.sequence)||event.sequence<1||
     !ref.test(event.function_ref||'')||!token(event.observed_revision)){
   issues.push(err('BAD_EVENT','Malformed event or unknown event kind',path,'repair-event-envelope'));continue;}
  if(seen.has(event.id)||event.sequence<=next){
   issues.push(err('DUPLICATE_OR_REPLAY','Duplicate event id or replayed sequence',path,'readback-external-cursor'));continue;}
  seen.add(event.id);
  if(event.sequence!==next+1){
   issues.push(err('EVENT_GAP',`Expected sequence ${next+1}, got ${event.sequence}`,path,
    'replay-missing-events-before-projecting'));continue;}
  next=event.sequence;
  const base={event_id:event.id,function_ref:event.function_ref,
   observed_revision:event.observed_revision,require_host_authorization:true,executed:false};
  if(triggers.has(event.type)||event.type==='function.invalidated'){
   const trigger=event.type==='function.invalidated'?'verification.failed':event.type;
   const plan=prepareReconciliation({function_ref:event.function_ref,
    observed_revision:event.observed_revision,trigger});
   if(!plan.ok){issues.push(err('INVALID_RECONCILIATION','Could not prepare invalidation',path,
    'refresh-external-graph'));continue;}
   actions.push({...base,operation:'reconcile',steps:plan.steps,
    ui_visibility:'must_be_decided_by_external_authoritative_provider'});
  }else if(event.type==='function.verified'){
   // Verification is not publication; a forged event must never reveal a working UI action.
   actions.push({...base,operation:'inspect_publication',port:'publication.transaction.inspect',
    gate:'independent_verified_receipt_and_revision'});
  }else if(event.type==='function.published'||event.type==='ui.contribution.changed'){
   if(event.type==='function.published'&&!token(event.commit_ref)){
    issues.push(err('MISSING_COMMIT','Committed publication reference is mandatory',path,
     'readback-publication-receipt'));continue;}
   actions.push({...base,operation:'refresh_ui',port:'ui.contribution.refresh',
    commit_ref:event.commit_ref??null,
    gate:'authorized-runtime-readback-of-committed-capability-revision'});
  }else if(event.type==='incident.detected'){
   const checked=validateIncident(event.incident);
   if(!checked.ok||event.incident.node_ref!==event.function_ref){
    issues.push(err('UNEXPLAINED_BLOCKER','Incident lacks matched cause/evidence/impact/remedy',path,
     'complete-diagnostic-package'));continue;}
   actions.push({...base,operation:'report_incident',port:'diagnostic.incident.report',
    incident_ref:event.incident.incident_id,gate:'external-diagnostic-proof'});
  }else if(event.type==='incident.remediation_attempted'){
   if(!token(event.attempt_ref)||!token(event.evidence_ref)){
    issues.push(err('MISSING_REMEDIATION_EVIDENCE','Attempt and evidence references required',path,
     'collect-attempt-and-result'));continue;}
   actions.push({...base,operation:'verify_remediation',port:'verification.acceptance.evaluate',
    attempt_ref:event.attempt_ref,evidence_ref:event.evidence_ref,
    gate:'independent-reverification-before-unblock'});
  }
 }
 // A batch is all-or-nothing; no cursor advance, no partial intents on gaps/invalid incidents.
 if(issues.length)return fail(issues);
 return {ok:true,schema:'forge.events.projection.v1',stream_id:p.stream_id,
  expected_cursor:p.cursor,proposed_cursor:{stream_id:p.stream_id,sequence:next,
   revision:p.events.at(-1).observed_revision},actions,
  cursor_committed:false,projected:true,executed:false,authorized:false,
  required_external_steps:['host-authorize','recheck-authoritative-revision',
   'apply-intents-atomically','commit-cursor-with-external-transaction']};
}
