import {strict as assert} from 'node:assert';
import {transactionPlan} from '../apps/nftables_preview/transaction.mjs';
const topology={nodes:[
 {id:'admin',kind:'client',addresses:['192.0.2.50']},
 {id:'server',kind:'server',addresses:['192.0.2.20']}],
 services:[{id:'api',node:'server',addresses:['192.0.2.20'],protocol:'tcp',port:8443}],
 rules:[{id:'admin-api',from:'admin',to:'api',effect:'allow',reason:'out-of-band management'}]};
const flow={from:'admin',to:'api',protocol:'tcp',port:8443};
const input={targetNode:'server',topology,managementFlows:[flow]};
const plan=transactionPlan(input);
assert.equal(plan.state,'draft');
assert.equal(plan.applied,false);
assert.equal(plan.readyToCommit,false);
assert.equal(plan.rollbackArmed,false);
assert.equal(plan.identityVerified,false);
assert.equal(plan.graph.nodes.length,8);
assert(plan.graph.nodes.every(g=>g.status==='blocked'));
assert.equal(plan.preview.candidate.length,1);
assert.equal(plan.warnings.some(w=>w.code==='management_flow_not_in_candidate'),false);
assert.deepEqual(plan,transactionPlan(input));
const mismatch=transactionPlan({...input,managementFlows:[{...flow,port:22}]});
assert(mismatch.warnings.some(w=>w.code==='management_flow_not_in_candidate'));
const missing=transactionPlan({targetNode:'server',topology});
assert(missing.warnings.some(w=>w.code==='management_probes_missing'));
const fakeInventory={schema:'network-inventory-snapshot-1',
 interfaces:[{name:'eth0',addresses:[{address:'192.0.2.20'}]}]};
const fakeWg={schema:'wireguard-graph-snapshot-1',status:'observed',issues:[]};
const evidence=transactionPlan({...input,inventory:fakeInventory,wireguard:fakeWg});
assert(evidence.warnings.some(w=>w.code==='inventory_unattested'));
assert(evidence.warnings.some(w=>w.code==='wireguard_unattested'));
assert.equal(evidence.readyToCommit,false);
assert.equal(evidence.applied,false);
const absent=transactionPlan({...input,inventory:{...fakeInventory,interfaces:[]}});
assert(absent.warnings.some(w=>w.code==='destination_not_seen_locally'));
assert.throws(()=>transactionPlan({...input,managementFlows:[{...flow,port:0}]}),/invalid_management_flow/);
assert.throws(()=>transactionPlan({...input,inventory:{}}),/invalid_inventory/);
console.log('GRAPH_TRANSACTION_OK eight blocked gates, management proof, no apply');
