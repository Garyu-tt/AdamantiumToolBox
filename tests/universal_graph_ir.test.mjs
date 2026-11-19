import test from 'node:test';
import assert from 'node:assert/strict';
import {UNIVERSAL_GRAPH_SCHEMA,validateUniversalGraph,editorProjection}
 from '../apps/universal_graph/ir.mjs';
import {planGraphComposition} from '../apps/universal_graph/composition.mjs';

const port=(id,direction,role,datatype)=>({id,direction,role,datatype});
const graph=(id,nodes,edges=[])=>({
 schema:UNIVERSAL_GRAPH_SCHEMA,id,revision:1,nodes,edges});
const cap=(id,ports)=>({id,kind:'capability',binding:{
 contract:'mas.feature.'+id+'.v1',version:'1.0.0'},ports});
const edge=(id,kind,a,ap,b,bp,feedback=false)=>({
 id,kind,source:{node:a,port:ap},target:{node:b,port:bp},
 ...(feedback?{feedback:true}:{})});

test('MAS composite pipeline: typed data and control, editor-only projection',()=>{
 const a=cap('load',[port('data','out','data','genesis.tensor.ref.v1')]);
 const b=cap('restore',[port('in','in','data','genesis.tensor.ref.v1'),
  port('out','out','data','genesis.tensor.ref.v1')]);
 const c=cap('consume',[port('in','in','data','genesis.tensor.ref.v1')]);
 const x=graph('mas.pipeline',[a,b,c],[
  edge('e1','data','load','data','restore','in'),
  edge('e2','data','restore','out','consume','in')]);
 assert.equal(validateUniversalGraph(x),x);
 const view=editorProjection(x);
 assert.equal(view.nodes.length,3);assert.equal(view.edges.length,2);
 assert.equal(view.executable,false);assert.equal(view.authorityGranted,false);
 assert.deepEqual(JSON.parse(JSON.stringify(x)),x);
});
test('GENESIS neural cycles need declared feedback and never become an executor',()=>{
 const v={id:'visual',kind:'neural_region',ports:[
  port('input','in','neural','genesis.spike.v1'),
  port('output','out','neural','genesis.spike.v1')]};
 const a={id:'association',kind:'neural_region',ports:[
  port('input','in','neural','genesis.spike.v1'),
  port('output','out','neural','genesis.spike.v1')]};
 const x=graph('genesis.brain',[v,a],[
  edge('a1','neural','visual','output','association','input'),
  edge('a2','neural','association','output','visual','input',true)]);
 assert.doesNotThrow(()=>validateUniversalGraph(x));
 assert.throws(()=>validateUniversalGraph(graph('bad.neural',[v,a],
  x.edges.map(e=>({...e,feedback:undefined})))),/directed_execution_cycle/);
 assert.throws(()=>validateUniversalGraph(graph('bad.datacycle',[v,a],
  [edge('x','data','visual','output','association','input')])),
  /incompatible_typed_ports/);
});
test('infra authority relation is descriptive and cannot grant permissions',()=>{
 const policy={id:'policy',kind:'policy',ports:[port('out','out','authority','mas.policy.claim.v1')]};
 const target={id:'server',kind:'device',ports:[port('in','in','authority','mas.policy.claim.v1')]};
 const x=graph('infra.policy',[policy,target],
  [edge('claim','authority','policy','out','server','in')]);
 const v=editorProjection(x);
 assert.equal(v.authorityGranted,false);
 assert.throws(()=>validateUniversalGraph(graph('bad.authexec',[policy,target],
  [edge('claim','control','policy','out','server','in')])),/incompatible_typed_ports/);
});
test('recursive composite resolves by version but cannot claim runtime execution',()=>{
 const child=graph('child.program',[cap('work',[
  port('out','out','data','genesis.tensor.ref.v1')])]);
 const root=graph('root.program',[{id:'module',kind:'composite',ports:[],
  graphRef:{id:'child.program',revision:1}}]);
 const p=planGraphComposition('root.program',[root,child]);
 assert.equal(p.graphs.length,2);assert.equal(p.runnable,false);
 assert.throws(()=>planGraphComposition('root.program',[root]),/subgraph_revision_unavailable/);
 const grandchild=graph('deep.program',[]);
 const nested=graph('child.program',[{id:'deeper',kind:'composite',ports:[],
  graphRef:{id:'deep.program',revision:1}}]);
 assert.throws(()=>planGraphComposition('root.program',[root,nested,grandchild],{maxDepth:1}),/composite_depth_budget/);
 const cycle=graph('child.program',[{id:'back',kind:'composite',ports:[],
  graphRef:{id:'root.program',revision:1}}]);
 assert.throws(()=>planGraphComposition('root.program',[root,cycle]),/recursive_composite_cycle/);
});
test('reject data cycle, wrong contracts, orphan and oversized graph',()=>{
 const a=cap('alpha',[port('in','in','data','mas.number.v1'),
  port('out','out','data','mas.number.v1')]);
 const b=cap('beta',[port('in','in','data','mas.number.v1'),
  port('out','out','data','mas.number.v1')]);
 const x=graph('cycle',[a,b],[edge('e1','data','alpha','out','beta','in'),
  edge('e2','data','beta','out','alpha','in')]);
 assert.throws(()=>validateUniversalGraph(x),/directed_execution_cycle/);
 x.edges[1].source.port='missing';
 assert.throws(()=>validateUniversalGraph(x),/incompatible_typed_ports/);
 assert.throws(()=>validateUniversalGraph(graph('large',[a,b]),{maxNodes:1}),
  /graph_budget_exceeded/);
});
