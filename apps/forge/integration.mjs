// Forge R04: purely advisory host dispatch and revision-coherence checks.
// No discovery, signature verification, invocation, graph/UI state or cursor ownership.
import {negotiateProviders} from './negotiation.mjs';
import {planPublication,prepareReconciliation} from './pipeline.mjs';

const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const namespaced=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/.test(x);
const fault=(code,reason,path,impact,fix,observed)=>({
 code,reason,evidence:{path,...(observed===undefined?{}:{observed})},impact,
 remedies:[{action:fix,safety:'external-authorization-required'}]
});
const rejected=issues=>({ok:false,executed:false,authorized:false,provider_bound:false,
 authoritative:false,ui_visible:false,issues});

/**
 * Build host-owned *requests* from a bounded external discovery snapshot.
 * The proposed targets must be re-resolved and authorized by the host before invocation.
 */
export function prepareIntegration(p,now=Date.now()){
 if(!obj(p)||p.schema!=='forge.integration.request.v1'||
    !['publication','reconciliation'].includes(p.flow))
  return rejected([fault('BAD_INTEGRATION_REQUEST','Supported integration flow and schema required','$',
   'No safe host dispatch requests can be prepared','select-supported-protocol')]);
 const plan=p.flow==='publication'?planPublication(p.input):prepareReconciliation(p.input);
 if(!plan.ok)return rejected(plan.errors||[fault('BAD_PLAN','Invalid external pipeline input','input',
  'Required steps unavailable','correct-pipeline-input')]);
 const requestId=p.flow==='publication'?p.input?.request_id:p.request_id;
 const expected=p.flow==='publication'?p.input?.expected_revision:p.input?.observed_revision;
 if(!nonempty(requestId)||!nonempty(expected))return rejected([
  fault('MISSING_IDEMPOTENCY_OR_REVISION','Stable request ID and external graph revision are mandatory',
   'request_id/expected_revision','Cannot safely prepare retryable revision-bound intents',
   'obtain-request-id-and-fresh-external-revision')]);
 const n=negotiateProviders({flow:p.flow,input:p.input,snapshot:p.snapshot},now);
 if(!n.ok||!n.complete)return rejected(n.issues.length?n.issues:[
  fault('INCOMPLETE_NEGOTIATION','No unambiguous set of candidate providers','snapshot',
   'Invocation would have unresolved dependencies','refresh-host-discovery')]);
 const intents=[];
 for(const [index,step] of plan.steps.entries()){
  const selected=n.selections.find(x=>x.step===step.id);
  if(!selected?.proposed||!nonempty(selected.proposed.node_ref)||
     !nonempty(selected.proposed.provider_ref)||!namespaced(selected.proposed.action_id))
   return rejected([fault('NO_EXPLICIT_TARGET','Every step requires one explicit candidate target',
    `steps[${index}]`,'Host cannot route this invocation','resolve-explicit-provider')]);
  intents.push({
   schema:'forge.host.dispatch.intent.v1',step_id:step.id,order:index,
   request_id:requestId,idempotency_key:`${requestId}:${step.id}`,
   target:structuredClone(selected.proposed),contract:step.port,mode:selected.mode,
   revision_precondition:expected,discovery_revision:n.snapshot_revision,
   policy_revision:n.policy_revision,expires_at:n.expires_at,
   depends_on:intents.at(-1)?.step_id??null,
   payload_source:index===0?'external-request':'previous-step-receipt',
   requires_host_identity_check:true,requires_host_policy_check:true,
   requires_host_revision_compare:true,retry_policy:'readback-before-retry',
   caller_authorized:false,executed:false
  });
 }
 return {ok:true,schema:'forge.integration.intents.v1',flow:p.flow,request_id:requestId,
  function_ref:p.flow==='publication'?plan.target.function_ref:p.input.function_ref,
  expected_revision:expected,snapshot_revision:n.snapshot_revision,
  policy_revision:n.policy_revision,expires_at:n.expires_at,intents,
  required_host_steps:['authenticate-pinned-node','rediscover-exact-action',
   'reauthorize-exact-permission','compare-policy-and-graph-revisions',
   'invoke-sequentially-with-external-receipts','readback-after-ambiguous-outcome'],
  executed:false,authorized:false,provider_bound:false,authoritative:false,
  ui_visible:false,can_execute:false};
}

export {assessVisibility} from './visibility.mjs';
