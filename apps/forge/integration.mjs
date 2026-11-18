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

/**
 * Cross-check untrusted external receipts. It NEVER decides runtime visibility:
 * the UI provider must independently read back the committed capability and policy.
 */
export function assessVisibility(p,now=Date.now()){
 if(!obj(p)||p.schema!=='forge.visibility.assessment.request.v1'||
    !['publish','revoke'].includes(p.mode)||!obj(p.evidence)||
    !obj(p.evidence.host)||!obj(p.evidence.commit)||!obj(p.evidence.capability)||
    (p.ui_exposed!==false&&!obj(p.evidence.ui)))
  return rejected([fault('BAD_VISIBILITY_REQUEST','Mode and externally supplied receipts are mandatory','$',
   'Visibility may not be inferred','supply-complete-external-readback')]);
 const host=p.evidence.host,commit=p.evidence.commit,cap=p.evidence.capability,
  ui=obj(p.evidence.ui)?p.evidence.ui:null,exposed=p.ui_exposed!==false,issues=[];
 const add=(code,reason,path,impact,fix,observed)=>issues.push(fault(code,reason,path,impact,fix,observed));
 if(!nonempty(host.policy_revision)||!nonempty(host.discovery_revision)||
    !nonempty(host.identity_ref)||!nonempty(host.observed_at)||!nonempty(host.expires_at))
  add('MISSING_HOST_CONTEXT','Identity, policy, discovery and time-bound readback required',
   'evidence.host','Cannot compare against current host view','refresh-authenticated-host-readback');
 const from=Date.parse(host.observed_at),until=Date.parse(host.expires_at);
 if(!Number.isFinite(now)||!Number.isFinite(from)||!Number.isFinite(until)||
    from>now+60000||until<=now||until<=from||until-from>300000)
  add('STALE_READBACK','Host readback expired or outside bounded time window',
   'evidence.host.expires_at','Result may have changed','refresh-authenticated-host-readback');
 if(!nonempty(p.function_ref)||!namespaced(p.function_ref)||!nonempty(p.expected_revision)||
    !nonempty(p.request_id))
  add('BAD_TARGET','Function, request, and prior revision required','$',
   'No unambiguous target','repair-function-and-revision');
 if(!nonempty(commit.request_id)||commit.request_id!==p.request_id||
    commit.function_ref!==p.function_ref||
    !nonempty(commit.committed_revision)||!nonempty(commit.base_revision)||
    commit.base_revision!==p.expected_revision||
    !nonempty(commit.policy_revision)||commit.policy_revision!==host.policy_revision||
    !nonempty(commit.transaction_ref))
  add('COMMIT_MISMATCH','Commit identity, base revision or policy is inconsistent',
   'evidence.commit','Cannot expose an uncommitted or mismatched function',
   'readback-transaction-by-id');
 if(cap.function_ref!==p.function_ref||cap.revision!==commit.committed_revision||
    !namespaced(cap.action)||!nonempty(cap.readback_ref)||
    cap.policy_revision!==host.policy_revision)
  add('CAPABILITY_MISMATCH','Capability must match committed revision, action and host policy',
   'evidence.capability','UI may point at a stale capability','refresh-capability-readback');
 if((exposed||ui!==null)&&(ui?.function_ref!==p.function_ref||
    ui?.revision!==commit.committed_revision||!nonempty(ui?.readback_ref)||
    ui?.policy_revision!==host.policy_revision||ui?.action!==cap.action))
  add('UI_MISMATCH','UI contribution must match capability and committed revision',
   'evidence.ui','UI could display the wrong action','refresh-ui-readback');
 if(p.mode==='publish'){
  const v=p.evidence.verification,exec=p.evidence.execution;
  if(!obj(v)||!obj(exec)||
     v.status!=='accepted'||!nonempty(v.evidence_ref)||!nonempty(v.verifier_ref)||
     v.function_ref!==p.function_ref||v.request_id!==p.request_id||
     exec.status!=='succeeded'||!nonempty(exec.executor_ref)||
     exec.function_ref!==p.function_ref||exec.request_id!==p.request_id||
     v.verifier_ref===exec.executor_ref||
     commit.status!=='committed'||commit.verification_ref!==v.evidence_ref)
   add('UNVERIFIED_PUBLICATION','Independent verification and a matching commit are mandatory',
    'evidence.verification','An unverified function must not be an actionable UI control',
    'run-independent-acceptance-and-commit');
  if(cap.available!==true||(exposed&&(ui?.visible!==true||ui?.contribution_ref!==`ui:${p.function_ref}`))||
     (!exposed&&ui?.visible===true))
   add('NOT_VISIBLE_IN_READBACK','Both capability and its UI contribution must appear in readback',
    'evidence.ui','Cannot confirm requested active state','readback-committed-runtime-and-ui');
  if(!nonempty(p.capability_action)||cap.action!==p.capability_action)
   add('ACTION_MISMATCH','Requested action differs from published capability',
    'capability_action','Potential wrong-function invocation','refresh-function-contract');
 }else{
  if(commit.status!=='revoked'||!nonempty(commit.cause_ref))
   add('NO_REVOCATION_CAUSE','Revocation must have committed status and a specific cause',
    'evidence.commit','Revocation not proven','readback-revocation-cause');
  if(cap.available!==false||(exposed&&ui?.visible!==false)||
     (!exposed&&ui?.visible===true))
   add('UNSAFE_REVOCATION','Revoked action must be unavailable and invisible',
    'evidence.ui','Old action could remain callable','deny-capability-and-hide-ui-externally');
 }
 if(issues.length)return rejected(issues);
 return {ok:true,schema:'forge.visibility.assessment.v1',mode:p.mode,
  request_id:p.request_id,function_ref:p.function_ref,
  structurally_consistent:true,
  candidate_result:p.mode==='publish'?'requires-authoritative-host-activation':'requires-authoritative-host-revocation',
  committed_revision:commit.committed_revision,policy_revision:host.policy_revision,
  ui_exposed:exposed,
  required_host_checks:['validate-actual-host-signatures-and-pinned-identity',
   'readback-authoritative-graph-capability-and-ui',
   'confirm-runtime-exact-action-and-current-authorization',
   'abort-on-revision-change-or-ambiguous-result'],
  // No matter what the caller claims, this adapter CANNOT attest to real UI state.
  executed:false,authorized:false,provider_bound:false,authoritative:false,
  ui_visible:false,can_execute:false};
}
