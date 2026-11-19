import {strict as assert} from 'node:assert';
import {inspect,simulate,plan} from '../apps/graph_firewall/policy.mjs';
const topology={nodes:[
 {id:'operator',kind:'client',addresses:['192.0.2.10']},
 {id:'host-a',kind:'server',addresses:['192.0.2.20']},
 {id:'guest',kind:'client',addresses:['192.0.2.30']}],
 services:[{id:'admin',node:'host-a',protocol:'tcp',port:8443,addresses:['192.0.2.20']}],
 rules:[{id:'allow-operator',from:'operator',to:'admin',effect:'allow',reason:'approved-management'}]};
const flow=(from='operator',port=8443)=>({from,to:'admin',protocol:'tcp',port});
const sample=inspect(topology);
assert.equal(sample.summary.nodes,3);
assert.equal(sample.summary.issues,0);
const mismatched={...topology,services:[{...topology.services[0],addresses:['192.0.2.99']}]};
assert(inspect(mismatched).issues.some(x=>x.code==='service_address_not_on_host'));
assert(sample.edges.some(x=>x.type==='allow'));
assert.equal(sample.effectiveDefault,'deny');
assert.equal(sample.safeToApply,false);
assert.equal(simulate({topology,flow:flow()}).verdict,'allow');
assert.equal(simulate({topology,flow:flow('guest')}).verdict,'deny');
assert.equal(simulate({topology,flow:flow('operator',22)}).verdict,'deny');
const withDeny={...topology,rules:[...topology.rules,
 {id:'deny-operator',from:'operator',to:'admin',effect:'deny',reason:'explicit-block'}]};
assert.equal(simulate({topology:withDeny,flow:flow()}).reason,'explicit_deny_overrides_allow');
assert(inspect(withDeny).issues.some(x=>x.code==='conflicting_effects'));
const removed={...topology,rules:[]};
const proposal=plan({current:topology,proposed:removed,managementFlows:[flow()]});
assert(proposal.risks.some(x=>x.code==='management_lockout'));
assert.deepEqual(proposal.removed,['allow-operator']);
assert.equal(proposal.applied,false);
assert(plan({current:topology,proposed:topology}).risks.some(x=>x.code==='management_path_unverified'));
assert.throws(()=>inspect({...topology,rules:[{id:'bad',from:'*',to:'admin',effect:'allow',reason:'broad'}]}),/invalid_rule/);
assert.throws(()=>inspect({...topology,nodes:[...topology.nodes,topology.nodes[0]]}),/invalid_node/);
assert.throws(()=>inspect({...topology,services:[{id:'admin',node:'host-a',protocol:'tcp',port:0}]}),/invalid_service/);
assert.throws(()=>simulate({topology,flow:{...flow(),from:'unknown'}}),/invalid_flow/);
console.log('GRAPH_FIREWALL_OK default-deny/conflicts/management-lockout/no-kernel-apply');
