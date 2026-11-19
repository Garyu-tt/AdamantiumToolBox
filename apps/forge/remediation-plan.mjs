// Unexecuted safe-remediation candidates: no agents, no attempts, no trust in offers.
import {obj,tok,ref,issue,step,fail,flags,incidentReport,revs,unique,tokens} from './remediation-common.mjs';
const codes={safe:'safe-deterministic',permissioned:'requires-explicit-approval',manual:'manual-investigation'};
export function planRemediation(p){
 const i=p?.incident,s=p?.snapshot;
 if(!obj(p)||p.schema!=='forge.remediation.plan.request.v1'||
  !tok(p.request_id)||!revs(s)||!tok(s.snapshot_ref)||!tok(s.attempt_journal_revision)||
  !Array.isArray(s.attempts)||s.attempts.length>64||
  !Array.isArray(s.providers)||s.providers.length>32||
  i.remedies.length>32||
  !Number.isInteger(p.max_attempts)||p.max_attempts<1||p.max_attempts>3)
  return fail([issue('INVALID_REMEDIATION_REQUEST','$',
   'Explained incident, bounded attempts and current revision-bound provider claims required',
   'query-incident-graph-provider-and-policy-snapshots')]);
 const incidentCheck=incidentReport(i);
 if(!incidentCheck.ok)return fail(incidentCheck.errors.map(e=>
  issue(e.code,e.path,e.reason,e.remedies?.[0]?.action||'collect-diagnostic-evidence')));
 const problems=[],ids=new Set(),attempts=new Map(),providers=new Set();
 for(const [n,a] of s.attempts.entries()){
  if(!obj(a)||!ref(a.remedy_ref)||ids.has(a.remedy_ref)||
   !Number.isInteger(a.count)||a.count<0||a.count>256)
   problems.push(issue('INVALID_ATTEMPT_COUNTER',`snapshot.attempts[${n}]`,
    'Non-unique or malformed externally recorded attempt count',
    'reload-durable-remediation-attempt-journal'));
  else {ids.add(a.remedy_ref);attempts.set(a.remedy_ref,a.count);}
 }
 for(const [n,x] of s.providers.entries()){
  if(!obj(x)||!ref(x.provider_ref)||providers.has(x.provider_ref)||
   x.port!=='remediation.attempt.safe'||typeof x.available!=='boolean')
   problems.push(issue('BAD_REMEDIATION_OFFER',`snapshot.providers[${n}]`,
    'Provider claim is ambiguous or incompatible', 'refresh-pinned-provider-discovery'));
  else providers.add(x.provider_ref);
 }
 const remedyRefs=i.remedies.map(r=>r.remedy_ref);
 if(!remedyRefs.every(ref)||!unique(remedyRefs))
  problems.push(issue('DUPLICATE_REMEDY','incident.remedies',
   'Every remedy needs a distinct stable remedy reference','assign-stable-remedy-ids'));
 const keys=i.remedies.filter(r=>r.risk==='safe').map(r=>r.idempotency_key).filter(tok);
 if(!unique(keys))problems.push(issue('SHARED_IDEMPOTENCY_KEY','incident.remedies',
  'Multiple safe remedies share a durable key','assign-unique-remedy-idempotency-keys'));
 for(const r of i.remedies.filter(r=>r.risk==='safe')){
  if(!attempts.has(r.remedy_ref))problems.push(issue('MISSING_ATTEMPT_JOURNAL',
   'snapshot.attempts','Safe remedy requires durable recorded counter, including zero',
   'fetch-current-durable-attempt-counter'));
 }
 if(problems.length)return fail(problems);
 const ready=[],deferred=[],available=s.providers.filter(x=>x.available);
 for(const r of i.remedies){
  const reason=[];let eligible=r.risk==='safe';
  if(!eligible)reason.push(codes[r.risk]);
  if(eligible&&r.reversible!==true)reason.push('reversibility-not-established');
  if(eligible&&!tok(r.idempotency_key))reason.push('no-durable-idempotency-key');
  if(eligible&&!tokens(r.acceptance_checks))reason.push('no-independent-acceptance-check');
  if(eligible&&(attempts.get(r.remedy_ref)||0)>=p.max_attempts)reason.push('retry-budget-exhausted');
  if(eligible&&!available.length)reason.push('no-available-remediation-provider');
  const candidate={remedy_ref:r.remedy_ref,action:r.action,risk:r.risk,
   reason_codes:reason,executable:false,authorized:false};
  if(!reason.length)ready.push({...candidate,idempotency_key:r.idempotency_key,
   acceptance_checks:r.acceptance_checks,provider_candidates:available.map(x=>x.provider_ref)});
  else deferred.push(candidate);
 }
 const notes=deferred.map(x=>issue('REMEDY_DEFERRED','incident.remedies',
  `${x.remedy_ref}: ${x.reason_codes.join(', ')}`,
  'fetch-evidence-or-request-human-approval-or-change-remedy'));
 if(!ready.length)notes.push(issue('NO_SAFE_ATTEMPT','incident.remedies',
  'No bounded independently verifiable safe attempt is currently eligible',
  'collect-diagnostics-or-escalate-specific-approval'));
 const steps=[step('re-read-incident-and-dependency-graph','graph.snapshot.read',
  {incident_id:i.incident_id,graph_revision:s.graph_revision}),
  step('recheck-current-policy-and-provider','capability.resolve',
  {policy_revision:s.policy_revision,incident_revision:s.incident_revision}),
  ...ready.slice(0,1).map(r=>step('request-deterministic-remedy','remediation.attempt.safe',
   {incident_id:i.incident_id,remedy_ref:r.remedy_ref,
    idempotency_key:r.idempotency_key,max_attempts:p.max_attempts})),
  step('verify-independent-acceptance','verification.acceptance.evaluate',
   {incident_id:i.incident_id,incident_revision:s.incident_revision}),
  step('record-explained-outcome','diagnostic.incident.report',
   {incident_id:i.incident_id})];
 return {ok:true,schema:'forge.remediation.plan.v1',request_id:p.request_id,
  incident_id:i.incident_id,node_ref:i.node_ref,revision_claims:{snapshot_ref:s.snapshot_ref,graph_revision:s.graph_revision,
   policy_revision:s.policy_revision,incident_revision:s.incident_revision,
   attempt_journal_revision:s.attempt_journal_revision},
  safe_candidates:ready,deferred_candidates:deferred,issues:notes,steps,
  requires_host_identity_and_policy_check:true,requires_external_verification:true,
  requires_durable_attempt_budget:true,one_attempt_per_reconciliation:true,...flags};
}
