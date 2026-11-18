import {strict as assert} from 'node:assert';
import {validateGraph,validateManifest} from '../core/contract.mjs';
import {validateModules} from '../sdk/modules.mjs';
import {makeGraph} from '../sdk/graph.mjs';
const manifest={mas:'1.0',id:'fixture',name:'Fixture',version:'1.0.0',icon:'studio',
 lifecycle:'independent',service:{protocol:'mas-http-1',port:9301},
 ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},auth:{mode:'host-delegated'},
 permissions:['fixture.read'],events:{schema:'mas-event-1'},data:{refs:'mas-ref-1'},
 updates:{strategy:'semver',migrations:[]}};
assert(validateManifest(manifest));
const cap=(id,type)=>({id,type,title:id,version:'1.0.0',permissions:['fixture.read'],
 ...(type==='action'?{input:{type:'object'},output:{type:'object'}}:{})});
const doc={schema:'mas-modules-1',app:'fixture',modules:[{
 id:'fixture.root',kind:'module',version:'1.0.0',provides:[cap('fixture.view','view')],
 children:[{id:'fixture.child',kind:'submodule',version:'1.0.0',
  provides:[cap('fixture.ping','action')],consumes:[
   {id:'fixture.view',version:'^1.0.0',optional:false},
   {id:'unrelated.preview',version:'^1.0.0',optional:true}],
  links:[{from:'fixture.view',to:'fixture.ping',type:'uses'}]}]}]};
assert.deepEqual(validateModules(doc,manifest),{modules:2,capabilities:2});
const graph=makeGraph(doc,manifest);
assert(validateGraph(graph,manifest));
assert.equal(graph.nodes.length,2);assert.equal(graph.edges.length,1);
const disabled=structuredClone(doc);disabled.modules[0].children[0].enabled=false;
assert.deepEqual(makeGraph(disabled,manifest).nodes.map(x=>x.id),['fixture.view']);
const mismatched=structuredClone(doc);
mismatched.modules[0].children[0].consumes[0].version='^2.0.0';
assert.deepEqual(makeGraph(mismatched,manifest).nodes.map(x=>x.id),['fixture.view']);
const external=structuredClone(doc);
external.modules[0].children[0].consumes[1].optional=false;
assert.throws(()=>validateModules(external,manifest),/invalid_dependency/);
const duplicate=structuredClone(doc);
duplicate.modules[0].children[0].provides.push(cap('fixture.view','view'));
assert.throws(()=>validateModules(duplicate,manifest),/invalid_capability/);
const cycle=structuredClone(doc);cycle.modules[0].children.push(cycle.modules[0]);
assert.throws(()=>validateModules(cycle,manifest),/invalid_tree/);
console.log('SDK_MODULES_OK recursion version gating optional deps isolation');
