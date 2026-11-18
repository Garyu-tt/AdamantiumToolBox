import {strict as assert} from 'node:assert';
import {assessVisibility} from '../apps/forge/integration.mjs';
import {runHttpR04} from './forge-r04-http.case.mjs';
export async function runVisibilityR04({fn,input,call,now}){
const host={policy_revision:'policy-42',discovery_revision:'discovery-91',identity_ref:'approved-mesh-id',
 observed_at:new Date(now-1000).toISOString(),expires_at:new Date(now+30000).toISOString()};
const commit={request_id:input.request_id,function_ref:fn.id,base_revision:input.expected_revision,
 committed_revision:'graph-82',policy_revision:host.policy_revision,
 transaction_ref:'txn-82',verification_ref:'evidence-82',status:'committed'};
const evidence={host,commit,execution:{status:'succeeded',executor_ref:'worker-1',
 request_id:input.request_id,function_ref:fn.id},
 verification:{status:'accepted',evidence_ref:'evidence-82',verifier_ref:'verifier-1',
 request_id:input.request_id,function_ref:fn.id},
 capability:{function_ref:fn.id,revision:'graph-82',action:fn.capability.action,
 readback_ref:'cap-read-82',policy_revision:host.policy_revision,available:true},
 ui:{function_ref:fn.id,revision:'graph-82',action:fn.capability.action,
 contribution_ref:`ui:${fn.id}`,readback_ref:'ui-read-82',
 policy_revision:host.policy_revision,visible:true}};
const request={schema:'forge.visibility.assessment.request.v1',mode:'publish',
 request_id:input.request_id,function_ref:fn.id,capability_action:fn.capability.action,
 expected_revision:input.expected_revision,evidence};
const check=assessVisibility(request,now);
assert.equal(check.ok,true);assert.equal(check.structurally_consistent,true);
assert.equal(check.authoritative,false);assert.equal(check.ui_visible,false);
assert.equal(check.can_execute,false);
assert(check.required_host_checks.some(x=>x.includes('signatures')));
const bad=e=>assessVisibility({...request,evidence:e},now);
assert.equal(bad({...evidence,ui:{...evidence.ui,revision:'graph-999'}}).ok,false);
assert.equal(bad({...evidence,host:{...host,policy_revision:'policy-old'}}).ok,false);
assert.equal(bad({...evidence,commit:{...commit,status:'pending'}}).ok,false);
assert.equal(bad({...evidence,verification:{...evidence.verification,
 verifier_ref:evidence.execution.executor_ref}}).ok,false);
assert.equal(bad({...evidence,verification:{...evidence.verification,
 evidence_ref:'wrong-proof'}}).ok,false);
assert.equal(bad({...evidence,capability:{...evidence.capability,
 available:false}}).ok,false);
assert.equal(bad({...evidence,host:{...host,expires_at:new Date(now-1).toISOString()}}).ok,false);
assert.equal(bad({...evidence,ui:{...evidence.ui,visible:false}}).ok,false);
// A deliberately headless capability is published without an invented UI control.
const hiddenEvidence={...evidence,ui:undefined};
const hidden=assessVisibility({...request,ui_exposed:false,evidence:hiddenEvidence},now);
assert.equal(hidden.ok,true);assert.equal(hidden.ui_exposed,false);
assert.equal(assessVisibility({...request,ui_exposed:false,evidence:{...evidence,
 ui:{...evidence.ui,visible:true}}},now).ok,false);

assert(bad({...evidence,ui:{...evidence.ui,visible:false}}).issues.every(x=>
 x.reason&&x.evidence&&x.impact&&x.remedies.length));
const revoke=assessVisibility({...request,mode:'revoke',
 evidence:{...evidence,commit:{...commit,status:'revoked',cause_ref:'incident-42'},
 capability:{...evidence.capability,available:false},ui:{...evidence.ui,visible:false}}},now);
assert.equal(revoke.ok,true);assert.equal(revoke.ui_visible,false);
assert.equal(assessVisibility({...request,mode:'revoke',evidence:{...evidence,
 commit:{...commit,status:'revoked',cause_ref:'incident-42'}}},now).ok,false);
// No client assertion (even "authorized:true") can turn receipt checking into real publication.
assert.equal(assessVisibility({...request,authorized:true,ui_visible:true},now).authoritative,false);
 await runHttpR04({call,request});
}
