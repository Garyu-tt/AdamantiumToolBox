// Receipt coherence is NOT proof that a real blocker has been resolved.
import {obj,tok,ref,refs,issue,step,fail,flags,revs,receiptIssue,unique} from './remediation-common.mjs';
const expected={attempt:'completed',verification:'passed',graph:'restored',
 incident:'resolved',audit:'recorded'};
export function assessRemediation(p){
 if(!obj(p)||p.schema!=='forge.remediation.assessment.request.v1'||
  !tok(p.request_id)||!tok(p.incident_id)||!ref(p.node_ref)||
  !ref(p.remedy_ref)||!tok(p.attempt_ref)||!revs(p)||!obj(p.evidence)||
  !refs(p.affected_refs)||!p.affected_refs.includes(p.node_ref)||
  !Array.isArray(p.acceptance_checks)||!p.acceptance_checks.length||
  p.acceptance_checks.length>24||!p.acceptance_checks.every(tok)||
  !unique(p.acceptance_checks))return fail([issue('INVALID_ASSESSMENT','$',
   'Complete incident, remedy, version and independent evidence scope required',
   're-read-incidents-attempt-journal-and-verification-contract')]);
 const issues=[];
 for(const [k,state] of Object.entries(expected)){
  const e=p.evidence[k];
  if(!obj(e)||e.state!==state||e.incident_id!==p.incident_id||
   e.remedy_ref!==p.remedy_ref||e.attempt_ref!==p.attempt_ref||
   e.graph_revision!==p.graph_revision||e.policy_revision!==p.policy_revision||
   e.incident_revision!==p.incident_revision)
   issues.push(receiptIssue(k,'is missing, incomplete, mis-scoped or stale'));
 }
 const v=p.evidence.verification,g=p.evidence.graph;
 if(obj(v)&&(!Array.isArray(v.passed_checks)||
  v.passed_checks.length!==p.acceptance_checks.length||
  !p.acceptance_checks.every(x=>v.passed_checks.includes(x))||
  !unique(v.passed_checks||[])))issues.push(receiptIssue('verification','does not cover every acceptance check'));
 if(obj(g)&&(!Array.isArray(g.restored_refs)||
  g.restored_refs.length!==p.affected_refs.length||
  !p.affected_refs.every(x=>g.restored_refs.includes(x))||
  !unique(g.restored_refs||[])))issues.push(receiptIssue('graph','does not cover all affected nodes'));
 const a=p.evidence.attempt;
 if(obj(a)&&obj(v)&&(!ref(a.executor_ref)||!ref(v.verifier_ref)||
  a.executor_ref===v.verifier_ref))
  issues.push(issue('NON_INDEPENDENT_VERIFICATION','evidence.verification',
   'Executor and independent verifier must have different provider references',
   'request-independent-verifier-readback'));
 if(obj(a)&&a.outcome!=='success')issues.push(receiptIssue('attempt','has no successful outcome'));
 if(obj(p.evidence.audit)&&!ref(p.evidence.audit.record_ref))
  issues.push(receiptIssue('audit','has no durable audit record reference'));
 if(obj(p.evidence.attempt)&&p.evidence.attempt.idempotency_key!==p.idempotency_key)
  issues.push(receiptIssue('attempt','idempotency key differs from requested remedy'));
 if(!tok(p.idempotency_key))issues.push(receiptIssue('attempt','has no durable idempotency key'));
 return {ok:true,schema:'forge.remediation.assessment.v1',request_id:p.request_id,
  incident_id:p.incident_id,remedy_ref:p.remedy_ref,attempt_ref:p.attempt_ref,
  issues,evidence_consistent:issues.length===0,
  suggested_next_step:issues.length?'reconcile-external-receipts-without-blind-retry':
   'ask-authoritative-incident-owner-to-verify-and-clear',
  steps:[step('re-read-authoritative-graph','graph.snapshot.read',
   {graph_revision:p.graph_revision,incident_id:p.incident_id}),
   step('verify-independent-acceptance','verification.acceptance.evaluate',
    {attempt_ref:p.attempt_ref,acceptance_checks:p.acceptance_checks}),
   step('confirm-incident-status-and-audit','diagnostic.incident.report',
    {incident_id:p.incident_id,incident_revision:p.incident_revision})],...flags};
}
