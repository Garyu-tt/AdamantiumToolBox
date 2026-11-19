import {obj,tok,ref,unique,revisions,issue,fail,step,flags} from './integrity-common.mjs';
const repairs={
 GHOST_UI_ACTION:['quarantine-ghost-ui-action','ui.projection.invalidate'],
 UNVERIFIED_PUBLICATION:['quarantine-unverified-function-ui','ui.projection.invalidate'],
 MISSING_PUBLISHED_CAPABILITY:['quarantine-missing-capability-ui','ui.projection.invalidate'],
 STALE_DEPENDENCY:['invalidate-dependent-views','ui.projection.invalidate'],
 ORPHAN_UI_MOUNT:['reconcile-orphan-ui-mount','ui.projection.invalidate'],
 REVERSE_INDEX_DRIFT:['request-reverse-index-rebuild','graph.reverse.reconcile'],
 ORPHAN_REVERSE_EDGE:['request-reverse-index-rebuild','graph.reverse.reconcile'],
 MISSING_DEPENDENCY:['revisit-dependent-function','taskpool.request.revisit'],
 BROKEN_CAPABILITY_LINK:['recheck-capability-forward-edge','graph.snapshot.read'],
 BROKEN_UI_LINK:['recheck-ui-forward-edge','graph.snapshot.read'],
 ORPHAN_CAPABILITY:['recheck-capability-owner','capability.resolve'],
 UNEXPLAINED_BLOCKER:['collect-blocker-diagnostics','diagnostic.incident.report'],
 DEPENDENCY_CYCLE:['review-atomic-function-boundaries','diagnostic.incident.report'],
 SHARED_FUNCTION_REQUEST:['review-duplicate-work-identity','taskpool.request.inspect']};
export function planIntegrityReconciliation(p){
 const a=p?.audit;
 if(!obj(p)||p.schema!=='forge.integrity.plan.request.v1'||!tok(p.request_id)||
  !obj(a)||a.schema!=='forge.integrity.audit.v1'||!tok(a.request_id)||
  !tok(a.snapshot_ref)||!revisions(a.revision_claims)||
  !Array.isArray(a.issues)||a.issues.length>256||
  !Number.isInteger(a.finding_count)||a.finding_count<a.issues.length||
  typeof a.findings_truncated!=='boolean'||
  a.findings_truncated!==(a.finding_count>a.issues.length)||
  typeof a.consistent!=='boolean'||
  a.consistent!==(a.finding_count===0))
  return fail([issue('INVALID_INTEGRITY_REPORT','$',
   'Versioned external audit result and exact finding count required',[],
   'rerun-integrity-audit-from-current-snapshot')]);
 const faults=[];
 for(const [i,f] of a.issues.entries())if(!obj(f)||!repairs[f.code]||
  typeof f.path!=='string'||f.path.length>300||
  typeof f.reason!=='string'||!Array.isArray(f.affected_refs)||
  f.affected_refs.length>256||!f.affected_refs.every(ref)||
  !unique(f.affected_refs))faults.push(issue('INVALID_FINDING',`audit.issues[${i}]`,
   'Finding is unrecognized or missing impacted references',[],
   'rerun-integrity-audit-with-supported-issue-contract'));
 if(faults.length)return fail(faults);
 const base={snapshot_ref:a.snapshot_ref,revisions:a.revision_claims};
 const dedup=new Set(),suggestions=[];
 for(const finding of a.issues){
  const [operation,port]=repairs[finding.code];
  const id=JSON.stringify([operation,port,finding.affected_refs]);
  if(dedup.has(id))continue;
  dedup.add(id);
  suggestions.push({issue_code:finding.code,reason:finding.reason,
   affected_refs:finding.affected_refs,action:step(operation,port,{
    ...base,affected_refs:finding.affected_refs}),executable:false});
 }
 const steps=[step('re-read-authoritative-graph-and-policy','graph.snapshot.read',base),
  ...suggestions.slice(0,32).map(x=>x.action),
  step('independently-verify-graph-and-ui-after-any-change',
   'verification.acceptance.evaluate',base)];
 return {ok:true,schema:'forge.integrity.plan.v1',request_id:p.request_id,
  source_audit_ref:a.request_id,snapshot_ref:a.snapshot_ref,
  revision_claims:a.revision_claims,untrusted_findings:true,
  candidate_operations:suggestions.slice(0,32),unplanned_findings:Math.max(0,suggestions.length-32),
  resnapshot_required:a.findings_truncated||suggestions.length>32,
  issues:a.findings_truncated?[issue('INCOMPLETE_AUDIT','audit',
   'Findings were truncated; the external graph owner must provide a complete paged snapshot',[],
   'resume-external-snapshot-audit-before-committing')]:[],
  steps,completion_requires_host_signed_readback:true,...flags};
}
