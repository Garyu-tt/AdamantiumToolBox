import {strict as assert} from 'node:assert';
import {compilePreview} from '../apps/nftables_preview/compile.mjs';
const nodes=[{id:'client',kind:'client',addresses:['192.0.2.3']},
 {id:'host',kind:'server',addresses:['192.0.2.8']}];
const services=[{id:'mail',node:'host',protocol:'tcp',port:993,addresses:['192.0.2.8']}];
const rules=[{id:'allow-mail',from:'client',to:'mail',effect:'allow',reason:'client-read'}];
const input={targetNode:'host',topology:{nodes,services,rules}};
const result=compilePreview(input);
assert.equal(result.candidate.length,1);
assert.equal(result.candidate[0].destinationPort,993);
assert.equal(result.candidate[0].addressFamily,'ip');
assert.equal(result.safeToApply,false);assert.equal(result.applied,false);
assert.equal(result.proposedBackend.attachedToKernel,false);
assert(result.unverified.includes('node_identity'));
assert.deepEqual(result,compilePreview(input));
assert.equal(compilePreview({...input,topology:{...input.topology,rules:[...rules,
 {id:'deny-mail',from:'client',to:'mail',effect:'deny',reason:'block'}]}}).candidate.length,0);
assert.equal(compilePreview({...input,topology:{...input.topology,nodes:[{...nodes[0],addresses:[]},nodes[1]]}}).candidate.length,0);
assert.throws(()=>compilePreview({...input,topology:{...input.topology,nodes:[...nodes,{...nodes[0]}]}}),/invalid_node/);
assert.throws(()=>compilePreview({...input,topology:{...input.topology,nodes:[{...nodes[0],addresses:['bad;flush ruleset']},nodes[1]]}}),/invalid_node/);
assert.throws(()=>compilePreview({...input,topology:{...input.topology,rules:[{...rules[0],from:'*'}]}}),/invalid_rule/);
assert.throws(()=>compilePreview({...input,targetNode:'other'}),/target_not_in_topology/);
console.log('GRAPH_NFTABLES_OK preview only, denies win, bounded literal inputs');
