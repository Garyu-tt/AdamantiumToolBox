// Synthetic inspector fixtures, not live incidents or authorized fixes.
export function makeRemediationSamples(fn){
 const rev={graph_revision:'demo-graph',policy_revision:'demo-policy',
  incident_revision:'demo-incident-revision'};
 const remedy={remedy_ref:'demo.rebuild_index',action:'rebuild-stale-index',
  risk:'safe',reversible:true,idempotency_key:'demo-once-index',
  acceptance_checks:['check.graph-consistent']};
 const incident={incident_id:'demo-incident',node_ref:fn.id,
  cause:{code:'STALE_INDEX',explanation:'External graph reports stale index'},
  evidence:[{ref:'diagnostic:demo'}],impact:{direct:[fn.id]},remedies:[remedy]};
 const scope={incident_id:incident.incident_id,remedy_ref:remedy.remedy_ref,
  attempt_ref:'demo-attempt',...rev};
 const receipt=(state,extra={})=>({...scope,state,...extra});
 return {'forge.remediation.plan':{schema:'forge.remediation.plan.request.v1',
  request_id:'demo-plan-10',incident,max_attempts:2,snapshot:{...rev,
   snapshot_ref:'demo-snapshot',attempt_journal_revision:'demo-journal',
   attempts:[{remedy_ref:remedy.remedy_ref,count:0}],providers:[{
    provider_ref:'demo.external_remediation',port:'remediation.attempt.safe',available:true}]}},
  'forge.remediation.assess':{schema:'forge.remediation.assessment.request.v1',
   request_id:'demo-assess-10',...scope,node_ref:fn.id,
   idempotency_key:remedy.idempotency_key,acceptance_checks:remedy.acceptance_checks,
   affected_refs:[fn.id],evidence:{attempt:receipt('completed',{
    idempotency_key:remedy.idempotency_key,outcome:'success',
    executor_ref:'demo.executor'}),verification:receipt('passed',{
    verifier_ref:'demo.verifier',
    passed_checks:remedy.acceptance_checks}),graph:receipt('restored',{
    restored_refs:[fn.id]}),incident:receipt('resolved'),audit:receipt('recorded',{record_ref:'demo.audit_record'})}}};
}
