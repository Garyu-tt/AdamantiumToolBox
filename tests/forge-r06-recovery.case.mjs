import {strict as assert} from 'node:assert';
import {recoverDistribution} from '../apps/forge/distribution.mjs';
import {runHttpR06} from './forge-r06-http.case.mjs';
export async function runRecoveryR06({input,issueCheck}){
const baseRecovery={schema:'forge.distribution.recovery.request.v1',
 operation_id:'distributed-operation-0001',request_id:input.request_id,mode:'publish',
 graph_revision:input.graph_revision,policy_revision:input.policy_revision,
 participants:[{node_ref:'node.alpha',function_refs:['sample.alpha'],status:'committed',
 receipt_ref:'receipt-alpha',operation_id:'distributed-operation-0001',committed_revision:'graph-revision-112',receipt_policy_revision:input.policy_revision},
 {node_ref:'node.beta',function_refs:['sample.beta'],status:'committed',
 receipt_ref:'receipt-beta',operation_id:'distributed-operation-0001',committed_revision:'graph-revision-112',receipt_policy_revision:input.policy_revision}],
 coordinator:{status:'committed',receipt_ref:'transaction-commit-receipt',operation_id:'distributed-operation-0001',committed_revision:'graph-revision-112',policy_revision:input.policy_revision},
 ui_readback:{state:'visible',receipt_ref:'ui-readback-1',operation_id:'distributed-operation-0001',revision:'graph-revision-112',policy_revision:input.policy_revision}};
const consistent=recoverDistribution(baseRecovery);
assert.equal(consistent.ok,true);assert.equal(consistent.candidate_state,'consistent-on-supplied-receipts');
assert.equal(consistent.safe_to_automatically_retry_writes,false);
assert.equal(consistent.safe_to_expose_ui,false);
assert.equal(consistent.authoritative,false);assert.equal(consistent.ui_visible,false);
const unknown=recoverDistribution({...baseRecovery,participants:[baseRecovery.participants[0],
 {...baseRecovery.participants[1],status:'unknown'}],ui_readback:{state:'unknown'}});
assert.equal(unknown.candidate_state,'ambiguous-outcome');
assert(unknown.issues.some(x=>x.code==='AMBIGUOUS_WRITE_RESULT'));
const partial=recoverDistribution({...baseRecovery,participants:[baseRecovery.participants[0],
 {...baseRecovery.participants[1],status:'failed'}],coordinator:{status:'unknown'},ui_readback:{state:'visible'}});
assert.equal(partial.candidate_state,'ambiguous-outcome');
assert(partial.issues.some(x=>x.code==='PARTIAL_DISTRIBUTED_COMMIT'));
assert(partial.issues.some(x=>x.code==='UI_EXPOSED_WITHOUT_COMMIT'));
const missingCommit=recoverDistribution({...baseRecovery,coordinator:{status:'prepared',receipt_ref:'transaction-stage'},ui_readback:{state:'visible',receipt_ref:'ui-now',operation_id:'distributed-operation-0001',revision:'graph-revision-112',policy_revision:input.policy_revision}});
assert(missingCommit.issues.some(x=>x.code==='UI_EXPOSED_WITHOUT_COMMIT'));
const noReceipt=recoverDistribution({...baseRecovery,participants:[{...baseRecovery.participants[0],receipt_ref:null},baseRecovery.participants[1]]});
assert(noReceipt.issues.some(x=>x.code==='MISSING_PARTICIPANT_RECEIPT'));
const dupFunction=recoverDistribution({...baseRecovery,participants:[baseRecovery.participants[0],
 {...baseRecovery.participants[1],function_refs:['sample.alpha']}]});
assert.equal(dupFunction.ok,false);assert(dupFunction.issues.some(x=>x.code==='BAD_PARTICIPANT'));
const revocation=recoverDistribution({...baseRecovery,mode:'revoke',ui_readback:{state:'hidden',receipt_ref:'ui-hidden',operation_id:'distributed-operation-0001',revision:'graph-revision-112',policy_revision:input.policy_revision}});
assert.equal(revocation.candidate_state,'consistent-on-supplied-receipts');
const mismatchedNode=recoverDistribution({...baseRecovery,participants:[baseRecovery.participants[0],
 {...baseRecovery.participants[1],committed_revision:'graph-revision-different'}]});
assert(mismatchedNode.issues.some(x=>x.code==='DIVERGENT_COMMIT_REVISIONS'));
assert.equal(mismatchedNode.candidate_state,'receipt-incomplete');
const staleUi=recoverDistribution({...baseRecovery,ui_readback:{...baseRecovery.ui_readback,revision:'graph-old'}});
assert(staleUi.issues.some(x=>x.code==='UI_REVISION_MISMATCH'));
const wrongPolicy=recoverDistribution({...baseRecovery,coordinator:{...baseRecovery.coordinator,policy_revision:'wrong'}});
assert(wrongPolicy.issues.some(x=>x.code==='COORDINATOR_POLICY_MISMATCH'));
for(const x of [unknown,partial,missingCommit,noReceipt,wrongPolicy,mismatchedNode,staleUi])issueCheck(x.issues);
// Core + only Forge: actual host HTTP/permission smoke, no peer services installed.
 await runHttpR06({input,baseRecovery});
}
