export const node='demo.compilation';
export const revisions={graph_revision:'graph-rev-10',policy_revision:'policy-rev-10',
 incident_revision:'incident-rev-10'};
export const remedy={remedy_ref:'demo.retry_index',action:'rebuild-stale-index',
 risk:'safe',reversible:true,idempotency_key:'once-incident-10-retry-index',
 acceptance_checks:['check.graph-consistent','check.reverse-deps']};
export const incident={incident_id:'incident-10',node_ref:node,
 cause:{code:'INDEX_STALE',explanation:'Index revision differs from committed graph'},
 evidence:[{ref:'diagnostic:trace-10'}],impact:{direct:[node]},
 remedies:[remedy,{remedy_ref:'demo.human_recovery',action:'approve-manual-migration',risk:'permissioned'}]};
export const planRequest={schema:'forge.remediation.plan.request.v1',
 request_id:'remediation-request-10',incident,max_attempts:2,snapshot:{
 ...revisions,attempt_journal_revision:'journal-rev-10',snapshot_ref:'snapshot-10',attempts:[{remedy_ref:remedy.remedy_ref,count:0}],
 providers:[{provider_ref:'demo.fix_provider',port:'remediation.attempt.safe',available:true}]}};
export const assessmentRequest={schema:'forge.remediation.assessment.request.v1',
 request_id:'assessment-request-10',incident_id:incident.incident_id,node_ref:node,
 remedy_ref:remedy.remedy_ref,attempt_ref:'attempt-10',idempotency_key:remedy.idempotency_key,
 ...revisions,acceptance_checks:[...remedy.acceptance_checks],affected_refs:[node],
 evidence:{}};
const base={incident_id:incident.incident_id,remedy_ref:remedy.remedy_ref,
 attempt_ref:'attempt-10',...revisions};
assessmentRequest.evidence={attempt:{...base,state:'completed',outcome:'success',executor_ref:'demo.executor',idempotency_key:remedy.idempotency_key},
 verification:{...base,state:'passed',verifier_ref:'demo.verifier',passed_checks:[...remedy.acceptance_checks]},
 graph:{...base,state:'restored',restored_refs:[node]},
 incident:{...base,state:'resolved'},audit:{...base,state:'recorded',record_ref:'demo.audit_record'}};
