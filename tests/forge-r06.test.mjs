import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planComposite} from '../apps/forge/composite.mjs';
import {planDistribution,recoverDistribution} from '../apps/forge/distribution.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const fn=(id,depends=[])=>({schema:'forge.function.v1',id,version:'1.2.0',
 request:{atomic:true,goal:`Implement ${id}`,acceptance:['Independent evidence accepted']},
 capability:{action:id,input_schema:{type:'object'},output_schema:{type:'object'}},
 dependencies:depends.map(capability=>({capability})),
 ui:{expose:true,role:'action',label:id}});
const comp=planComposite({schema:'forge.composite.request.v1',request_id:'distribution-composite-0001',
 functions:[fn('sample.alpha'),fn('sample.beta',['sample.alpha'])],
 root:{kind:'group',id:'sample.system',version:'1.0.0',label:'Example',children:[
  {kind:'group',id:'sample.group.alpha',version:'1.0.0',label:'A',children:[
   {kind:'function',ref:'sample.alpha'}, {kind:'function',ref:'sample.beta'}]},
  {kind:'group',id:'sample.group.beta',version:'1.0.0',label:'B',children:[
   {kind:'function',ref:'sample.alpha'}]}
 ]}});
assert.equal(comp.ok,true,JSON.stringify(comp.errors));
const place=(id,node)=>({function_ref:id,node_ref:node,provider_ref:`provider.${node}`,
 action_id:id,contract_version:'1.2.0',primary:true,status:'reachable',
 can_invoke:true,identity_pinned:true,policy_allowed:true});
const coordinator=()=>({node_ref:'node.gamma',provider_ref:'provider.commit',
 action_id:'publication.transaction.commit',contract_version:'1.0.0',primary:true,
 status:'reachable',can_invoke:true,identity_pinned:true,policy_allowed:true});
const input={schema:'forge.distribution.request.v1',request_id:'distributed-request-0001',
 graph_revision:'graph-revision-111',policy_revision:'policy-revision-222',
 discovery_revision:'discovery-revision-333',composition:comp,
 placements:[place('sample.alpha','node.alpha'),place('sample.beta','node.beta')],
 coordinator:coordinator()};
const planned=planDistribution(input);
assert.equal(planned.ok,true,JSON.stringify(planned.issues));
assert.equal(planned.complete,true,JSON.stringify(planned.blockers));
assert.equal(planned.placements.length,2);
assert.equal(planned.dependency_links.length,1);
assert.deepEqual(planned.dependency_links[0].from_node_ref,'node.beta');
assert.deepEqual(planned.dependency_links[0].to_node_ref,'node.alpha');
assert.deepEqual(planned.placements.map(x=>x.function_ref),['sample.alpha','sample.beta']);
assert.equal(planned.ui_stage_refs.length,5); // 2 functions + 3 groups; shared function once
assert(planned.steps.every(x=>x.executable===false&&x.authorized===false));
assert.equal(planned.authoritative,false);assert.equal(planned.can_execute,false);
assert.deepEqual(planDistribution(input).dependency_links,planned.dependency_links);
const issueCheck=xs=>assert(xs.every(x=>x.reason&&x.evidence&&x.impact&&x.remedies?.length));
const incomplete=planDistribution({...input,placements:[input.placements[0]]});
assert.equal(incomplete.ok,true);assert.equal(incomplete.complete,false);
assert(incomplete.blockers.some(x=>x.code==='MISSING_PLACEMENT'));issueCheck(incomplete.blockers);
const noCoordinator=planDistribution({...input,coordinator:null});
assert.equal(noCoordinator.ok,true);assert.equal(noCoordinator.ready_for_host_checks,false);
assert(noCoordinator.blockers.some(x=>x.code==='MISSING_TRANSACTION_COORDINATOR'));
const standby=planDistribution({...input,placements:[{...input.placements[0],primary:false,status:'read_only_standby'},input.placements[1]]});
assert.equal(standby.complete,false);assert(standby.blockers.some(x=>x.code==='UNVERIFIED_OR_UNREACHABLE_TARGET'));
const duplicated=planDistribution({...input,placements:[...input.placements,input.placements[0]]});
assert.equal(duplicated.ok,false);assert(duplicated.issues.some(x=>x.code==='AMBIGUOUS_PLACEMENT'));issueCheck(duplicated.issues);
const wrongAction=planDistribution({...input,placements:[{...input.placements[0],action_id:'sample.bad'},input.placements[1]]});
assert.equal(wrongAction.ok,false);assert(wrongAction.issues.some(x=>x.code==='INCOMPATIBLE_PLACEMENT'));
const wrongMajor=planDistribution({...input,placements:[{...input.placements[0],contract_version:'2.0.0'},input.placements[1]]});
assert.equal(wrongMajor.ok,false);
const badComp=planDistribution({...input,composition:{...comp,work_items:[...comp.work_items,comp.work_items[0]]}});
assert.equal(badComp.ok,false);assert(badComp.issues.some(x=>x.code==='BAD_WORK_ITEM'));
const extComp=planComposite({schema:'forge.composite.request.v1',request_id:'distribution-composite-0002',
 functions:[fn('sample.external',['external.audit'])],root:{kind:'group',id:'sample.external_group',
 version:'1.0.0',label:'External',children:[{kind:'function',ref:'sample.external'}]}});
assert.equal(extComp.ok,true);
const unresolved=planDistribution({...input,composition:extComp,placements:[place('sample.external','node.alpha')]});
assert.equal(unresolved.ok,true);assert.equal(unresolved.complete,false);
assert(unresolved.blockers.some(x=>x.code==='UNRESOLVED_EXTERNAL_DEPENDENCY'));
import {runRecoveryR06} from './forge-r06-recovery.case.mjs';
await runRecoveryR06({input,issueCheck});
