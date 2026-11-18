import {strict as assert} from 'node:assert';
export async function runAssessmentR07({request,plan,headless,issueCheck,assessReactive}){
const commit={status:'committed',commit_ref:'ui-batch-commit-88',
 readback_ref:'ui-batch-readback-88',request_id:request.request_id,
 expected_ui_revision:request.cursor.ui_revision,applied_ui_revision:'ui-9',
 graph_revision:plan.proposed_cursor.graph_revision,
 policy_revision:request.cursor.policy_revision,
 transaction_refs:['transaction-88'],event_ids:plan.changes.map(x=>x.event_id)};
const cursor_ack={status:'committed',stream_id:request.stream_id,
 sequence:plan.proposed_cursor.sequence,
 graph_revision:plan.proposed_cursor.graph_revision,ui_revision:'ui-9',
 policy_revision:request.cursor.policy_revision,
 readback_ref:'durable-cursor-88',commit_ref:commit.commit_ref};
const ui_readbacks=plan.changes.flatMap(ch=>ch.ui_mount_refs.map(m=>({
 mount_ref:m,function_ref:ch.function_ref,state:ch.desired_state,
 action_id:ch.action_id,capability_revision:ch.capability_revision,
 ui_revision:'ui-9',graph_revision:plan.proposed_cursor.graph_revision,
 policy_revision:request.cursor.policy_revision,readback_ref:'ui-readback-'+m})));
const good={schema:'forge.reactive.assess.request.v1',request_id:request.request_id,
 plan,commit,cursor_ack,ui_readbacks};
const accepted=assessReactive(good);
assert.equal(accepted.ok,true,JSON.stringify(accepted.issues));
assert.equal(accepted.observed_consistent,true);
assert.equal(accepted.candidate_state,'consistent-on-supplied-receipts');
assert.equal(accepted.authoritative,false);assert.equal(accepted.ui_updated,false);
assert.equal(accepted.cursor_committed,false);assert.equal(accepted.can_execute,false);
const bad=(input,code)=>{const result=assessReactive(input);
 assert.equal(result.ok,false);assert(result.issues.some(x=>x.code===code),
 JSON.stringify(result.issues));issueCheck(result);return result;};
bad({...good,commit:{...commit,status:'prepared'}},'UI_COMMIT_MISMATCH');
bad({...good,commit:{...commit,applied_ui_revision:request.cursor.ui_revision}},'UI_COMMIT_MISMATCH');
bad({...good,commit:{...commit,policy_revision:'policy-old'}},'UI_COMMIT_MISMATCH');
bad({...good,commit:{...commit,transaction_refs:[]}},'UI_COMMIT_MISMATCH');
bad({...good,commit:{...commit,event_ids:['event-a']}},'UI_COMMIT_MISMATCH');
bad({...good,cursor_ack:{...cursor_ack,sequence:13}},'CURSOR_ACK_MISMATCH');
bad({...good,cursor_ack:{...cursor_ack,status:'pending'}},'CURSOR_ACK_MISMATCH');
bad({...good,cursor_ack:{...cursor_ack,ui_revision:'ui-stale'}},'CURSOR_ACK_MISMATCH');
bad({...good,ui_readbacks:[ui_readbacks[0]]},'MISSING_UI_READBACK');
bad({...good,ui_readbacks:[...ui_readbacks,ui_readbacks[0]]},'UNKNOWN_OR_DUPLICATE_MOUNT');
bad({...good,ui_readbacks:[{...ui_readbacks[0],state:'hidden'},ui_readbacks[1]]},
 'UI_READBACK_MISMATCH');
bad({...good,ui_readbacks:[ui_readbacks[0],{...ui_readbacks[1],state:'visible'}]},
 'UI_READBACK_MISMATCH');
bad({...good,ui_readbacks:[{...ui_readbacks[0],ui_revision:'ui-old'},ui_readbacks[1]]},
 'UI_READBACK_MISMATCH');
const headlessGood={...good,plan:headless,commit:{...commit,
 graph_revision:headless.proposed_cursor.graph_revision,
 event_ids:headless.changes.map(x=>x.event_id)},
 cursor_ack:{...cursor_ack,sequence:headless.proposed_cursor.sequence,
 graph_revision:headless.proposed_cursor.graph_revision},ui_readbacks:[]};
assert.equal(assessReactive(headlessGood).ok,true);
}
