const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const namespaced=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/.test(x);
const fault=(code,reason,path,impact,fix,observed)=>({code,reason,
 evidence:{path,...(observed===undefined?{}:{observed})},impact,
 remedies:[{action:fix,safety:'external-authorization-required'}]});
const rejected=issues=>({ok:false,executed:false,authorized:false,provider_bound:false,
 authoritative:false,ui_visible:false,issues});
export function assessVisibility(p,now=Date.now()){ 
 if(!obj(p)||p.schema!=='forge.visibility.assessment.request.v1'||
    !['publish','revoke'].includes(p.mode)||!obj(p.evidence)||
    !obj(p.evidence.host)||!obj(p.evidence.commit)||!obj(p.evidence.capability)||
    (p.ui_exposed!==false&&!obj(p.evidence.ui)))
  return rejected([fault('BAD_VISIBILITY_REQUEST','Mode and externally supplied receipts are mandatory','$',
   'Visibility is unproven','supply-complete-external-readback')]);
 const host=p.evidence.host,commit=p.evidence.commit,cap=p.evidence.capability,
  ui=obj(p.evidence.ui)?p.evidence.ui:null,exposed=p.ui_exposed!==false,issues=[];
 const add=(code,reason,path,impact,fix,observed)=>issues.push(fault(code,reason,path,impact,fix,observed));
 if(!nonempty(host.policy_revision)||!nonempty(host.discovery_revision)||
    !nonempty(host.identity_ref)||!nonempty(host.observed_at)||!nonempty(host.expires_at))
  add('MISSING_HOST_CONTEXT','Host identity, policy, discovery, timestamps required',
   'evidence.host','Host context missing','refresh-authenticated-host-readback');
 const from=Date.parse(host.observed_at),until=Date.parse(host.expires_at);
 if(!Number.isFinite(now)||!Number.isFinite(from)||!Number.isFinite(until)||
    from>now+60000||until<=now||until<=from||until-from>300000)
  add('STALE_READBACK','Readback expired or exceeds time limit',
   'evidence.host.expires_at','Result may be stale','refresh-authenticated-host-readback');
 if(!nonempty(p.function_ref)||!namespaced(p.function_ref)||!nonempty(p.expected_revision)||
    !nonempty(p.request_id))
  add('BAD_TARGET','Function, request and revision required','$',
   'No unambiguous target','repair-function-and-revision');
 if(!nonempty(commit.request_id)||commit.request_id!==p.request_id||
    commit.function_ref!==p.function_ref||
    !nonempty(commit.committed_revision)||!nonempty(commit.base_revision)||
    commit.base_revision!==p.expected_revision||
    !nonempty(commit.policy_revision)||commit.policy_revision!==host.policy_revision||
    !nonempty(commit.transaction_ref))
  add('COMMIT_MISMATCH','Commit identity, revision or policy mismatch',
   'evidence.commit','Commit mismatch; do not expose function',
   'readback-transaction-by-id');
 if(cap.function_ref!==p.function_ref||cap.revision!==commit.committed_revision||
    !namespaced(cap.action)||!nonempty(cap.readback_ref)||
    cap.policy_revision!==host.policy_revision)
  add('CAPABILITY_MISMATCH','Capability revision, action or policy mismatch',
   'evidence.capability','UI may point at a stale capability','refresh-capability-readback');
 if((exposed||ui!==null)&&(ui?.function_ref!==p.function_ref||
    ui?.revision!==commit.committed_revision||!nonempty(ui?.readback_ref)||
    ui?.policy_revision!==host.policy_revision||ui?.action!==cap.action))
  add('UI_MISMATCH','UI revision or action mismatch',
   'evidence.ui','UI action mismatch','refresh-ui-readback');
 if(p.mode==='publish'){
  const v=p.evidence.verification,exec=p.evidence.execution;
  if(!obj(v)||!obj(exec)||
     v.status!=='accepted'||!nonempty(v.evidence_ref)||!nonempty(v.verifier_ref)||
     v.function_ref!==p.function_ref||v.request_id!==p.request_id||
     exec.status!=='succeeded'||!nonempty(exec.executor_ref)||
     exec.function_ref!==p.function_ref||exec.request_id!==p.request_id||
     v.verifier_ref===exec.executor_ref||
     commit.status!=='committed'||commit.verification_ref!==v.evidence_ref)
   add('UNVERIFIED_PUBLICATION','Independent verification and matching commit required',
    'evidence.verification','Unverified function cannot be clickable',
    'run-independent-acceptance-and-commit');
  if(cap.available!==true||(exposed&&(ui?.visible!==true||ui?.contribution_ref!==`ui:${p.function_ref}`))||
     (!exposed&&ui?.visible===true))
   add('NOT_VISIBLE_IN_READBACK','Capability and UI readback required',
    'evidence.ui','Requested state unconfirmed','readback-committed-runtime-and-ui');
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
  executed:false,authorized:false,provider_bound:false,authoritative:false,
  ui_visible:false,can_execute:false};
}
