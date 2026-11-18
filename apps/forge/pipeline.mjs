// Forge R02: pure request/graph/publication plans. Does not invoke providers or persist state.
import {validateFunction} from './contract.mjs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ref=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
const fault=(code,path,reason,remedies=['correct-input'])=>({code,path,reason,
 evidence:{path,check:code},impact:'Cannot authorize this plan',
 remedies:remedies.map(action=>({action,safety:'manual-input'}))});
const rejected=errors=>({ok:false,executed:false,provider_bound:false,errors});
function input(p){
 const v=validateFunction(p?.function);
 if(!v.ok)return {errors:v.errors};
 const errors=[];
 if(typeof p.request_id!=='string'||p.request_id.length<8||p.request_id.length>128)
  errors.push(fault('BAD_REQUEST_ID','request_id','Stable request id (8..128 chars) required',['supply-idempotency-key']));
 if(p.expected_revision!==undefined&&p.expected_revision!==null&&
    (typeof p.expected_revision!=='string'||p.expected_revision.length>128||!p.expected_revision))
  errors.push(fault('BAD_REVISION','expected_revision','Opaque revision token required',['refresh-external-revision']));
 return {errors,fn:p.function};
}
const uiSpec=fn=>({
 schema:'forge.ui.contribution.v1',id:`ui:${fn.id}`,function_ref:fn.id,
 action:fn.capability.action,version:fn.version,
 role:fn.ui?.expose===false?'none':(fn.ui?.role||'action'),
 label:fn.ui?.label||fn.id.split('.').at(-1),
 expose:fn.ui?.expose!==false,renderer:'raw',
 input_schema:fn.capability.input_schema,
 requires_permission:fn.capability.permission||null,
 // This is only a declaration; UI Graph must independently verify publication.
 availability:'unverified'
});
export function composeFunction(p){
 const {errors,fn}=input(p);
 if(errors.length)return rejected(errors);
 const nodes=[
  {id:fn.id,kind:'function',version:fn.version,requested_by:p.request_id},
  {id:`capability:${fn.capability.action}`,kind:'capability',version:fn.version}
 ];
 const edges=[{from:fn.id,to:`capability:${fn.capability.action}`,kind:'provides'},
  ...(fn.dependencies||[]).map(d=>({from:fn.id,to:`capability:${d.capability}`,kind:'depends_on'}))];
 const ui=uiSpec(fn);
 nodes.push({id:ui.id,kind:'ui_contribution',availability:'unverified'});
 edges.push({from:`capability:${fn.capability.action}`,to:ui.id,kind:'displayed_as'});
 return {ok:true,executed:false,provider_bound:false,persisted:false,
  schema:'forge.graph.intent.v1',request_id:p.request_id,
  expected_revision:p.expected_revision??null,
  graph_intent:{nodes,edges,authoritative_owner:'external-graph-manager'},
  ui_draft:ui,validation_level:'structural-only'};
}
export function planPublication(p){
 const result=composeFunction(p);
 if(!result.ok)return result;
 const fn=p.function,ui=result.ui_draft;
 // A recipe for external orchestration, never a proof that any provider exists.
 const steps=[
  {id:'resolve',port:'capability.resolve',gate:'compatible_provider_and_permissions'},
  {id:'execute',port:'capability.invoke',gate:'idempotent_request_revision_match'},
  {id:'verify',port:'verification.acceptance.evaluate',gate:'independent_success_and_signed_evidence'},
  {id:'stage_graph',port:'graph.revision.stage',gate:'revision_compare_and_swap'},
  {id:'stage_capability',port:'capability.publication.stage',gate:'same_revision_and_contract'},
  ...(ui.expose?[{id:'stage_ui',port:'ui.contribution.stage',gate:'not_visible_until_commit'}]:[]),
  {id:'commit',port:'publication.transaction.commit',gate:'atomic_visibility_or_abort'},
  {id:'audit',port:'provenance.record.append',gate:'durable_receipt'}
 ];
 return {ok:true,schema:'forge.publication.plan.v1',request_id:p.request_id,
  target:{function_ref:fn.id,action:fn.capability.action,version:fn.version},
  expected_revision:p.expected_revision??null,steps,ui_draft:ui,
  graph_intent:result.graph_intent,
  execution_policy:{one_function_per_request:true,requires_external_verifier:true,
   publish_only_after_commit:true,abort_on_missing_port:true,
   on_conflict:'refetch_and_replan',on_ambiguous_commit:'readback_never_blind_retry'},
  executed:false,provider_bound:false,verified:false,published:false,ui_visible:false,
  validation_level:'structural-only'};
}
export function prepareReconciliation(p){
 const errors=[];
 if(!object(p)||typeof p.function_ref!=='string'||!ref.test(p.function_ref))
  errors.push(fault('BAD_FUNCTION_REF','function_ref','Namespaced function reference required'));
 if(!object(p)||typeof p.observed_revision!=='string'||!p.observed_revision||p.observed_revision.length>128)
  errors.push(fault('BAD_OBSERVED_REVISION','observed_revision','External revision cursor required'));
 if(!object(p)||!['dependency.changed','provider.revoked','verification.failed',
   'permission.changed','artifact.changed','contract.changed'].includes(p.trigger))
  errors.push(fault('BAD_TRIGGER','trigger','Known invalidation trigger required'));
 if(errors.length)return rejected(errors);
 return {ok:true,schema:'forge.reconcile.plan.v1',function_ref:p.function_ref,
  observed_revision:p.observed_revision,trigger:p.trigger,
  steps:[
   {id:'discover_impacted',port:'graph.reverse_dependencies.read',gate:'authoritative_revision_and_affected_nodes'},
   {id:'invalidate',port:'graph.revision.invalidate',gate:'compare_and_swap_revision'},
   {id:'revoke_ui',port:'ui.contribution.revoke',gate:'hide_unverified_actions_before_reprocessing'},
   {id:'resubmit',port:'tasks.work.reconsider',gate:'new_request_ids_and_revision_lease'},
   {id:'diagnose',port:'diagnostic.incident.report',gate:'cause_evidence_impact_and_remedies'}
  ],executed:false,provider_bound:false,invalidated:false,ui_revoked:false,
  requires_external_readback:true};
}
export {validateIncident} from './incident.mjs';
