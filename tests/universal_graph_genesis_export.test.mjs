import test from 'node:test';
import assert from 'node:assert/strict';
import {exportGenesisToUniversal,extractGenesisGraph,
 UNIVERSAL_GRAPH_SCHEMA} from '../apps/universal_graph_genesis/bridge.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const region=id=>({id,kind:'region',neurons:128,layers:3,topology:'sparse',
 genome:{seed:7,plasticity:0.5},ports:[
 {id:'context',contract:'genesis.context.output.v1',direction:'out'},
 {id:'feedback',contract:'genesis.context.input.v1',direction:'in'}]});
const hub=id=>({id,kind:'hub',label:'Hub',x:0,y:0});
const sample=()=>({schema:'genesis.pe.graph.v1',version:1,
 nodes:[region('visual'),region('association'),hub('connector_hub')],
 edges:[
 {id:'signal_1',kind:'synapse',from:'visual',to:'association',minLinks:10,maxLinks:200},
 {id:'signal_2',kind:'synapse',from:'association',to:'visual',minLinks:1,maxLinks:50},
 {id:'route_1',kind:'route',from:'association',to:'connector_hub'}]});
test('G3 exports valid typed Rete-neutral IR and preserves source without state',()=>{
 const src=sample(),before=clone(src);
 src.nodes[0].genome.chemistry={concentrations:{dopamine:0.5},receptors:[]};
 const {graph,provenance}=exportGenesisToUniversal(src,{revision:3});
 assert.equal(graph.schema,UNIVERSAL_GRAPH_SCHEMA);
 assert.equal(graph.domain,'neural');assert.equal(graph.revision,3);
 assert.equal(graph.nodes[0].kind,'brain-region');
 assert.equal(graph.nodes[2].kind,'service');
 assert.deepEqual(graph.edges.map(x=>x.semantics),['signal','signal','route']);
 assert.deepEqual(graph.edges.map(x=>x.delayTicks),[1,1,0]);
 assert(graph.nodes[0].ports.some(p=>p.id==='cap_context'&&
  p.dataType==='genesis.context.output@1'&&p.semantics==='data'));
 assert.equal(provenance.executionAuthorized,false);
 assert.equal(provenance.networkChangesAuthorized,false);
 assert.equal(provenance.runtimeStateCopied,false);
 assert.equal(provenance.chemistryCopied,false);
 assert.equal(JSON.stringify(graph).includes('dopamine'),false);
 assert.equal(JSON.stringify(graph).includes('genome'),false);
 assert.deepEqual(src.nodes[1],before.nodes[1]);
});
test('legacy snapshot envelope accepted without swallowing neuro/chemical runtime',()=>{
 const src=sample();
 const snapshot={graph:src,development:{visual:{population:99}},chemistry:{visual:{dopamine:1}}};
 const read=extractGenesisGraph(snapshot);
 assert.equal(read,src);
 const out=exportGenesisToUniversal(read);
 assert.equal(JSON.stringify(out.graph).includes('99'),false);
 assert.equal(JSON.stringify(out.graph).includes('dopamine'),false);
 assert.throws(()=>extractGenesisGraph({development:{}}),/invalid_genesis_document/);
});
test('no implicit authorization and route/signal never merge semantics',()=>{
 const doc=sample();
 const x=exportGenesisToUniversal(doc);
 const sig=x.graph.edges[0],route=x.graph.edges[2];
 assert.equal(sig.fromPort,'signal_out');assert.equal(sig.toPort,'signal_in');
 assert.equal(route.fromPort,'route_out');assert.equal(route.toPort,'route_in');
 const v=x.graph.nodes[1],h=x.graph.nodes[2];
 assert(v.ports.find(p=>p.id==='route_out').semantics==='route');
 assert(h.ports.find(p=>p.id==='route_in').direction==='input');
 const changed=clone(doc);changed.edges[2].to='visual';
 assert.throws(()=>exportGenesisToUniversal(changed),/invalid_route_projection/);
});
test('enforces deliberate 1+ tick delay for recurrent signals',()=>{
 const doc=sample();
 assert.throws(()=>exportGenesisToUniversal(doc,{signalDelayTicks:0}),/signal_delay_required/);
 const out=exportGenesisToUniversal(doc,{signalDelayTicks:2}).graph;
 assert(out.edges.filter(e=>e.semantics==='signal').every(e=>e.delayTicks===2));
});
test('reject duplicate, invalid ID, unsafe source and orphan edges',()=>{
 const bad=fn=>{const s=sample();fn(s);return s};
 assert.throws(()=>exportGenesisToUniversal(bad(s=>s.nodes[1].id=s.nodes[0].id)),/duplicate_source_node/);
 assert.throws(()=>exportGenesisToUniversal(bad(s=>s.nodes[0].id='UPPER')),/invalid_node_id/);
 assert.throws(()=>exportGenesisToUniversal(bad(s=>s.edges[0].to='ghost')),/orphan_source_edge/);
 assert.throws(()=>exportGenesisToUniversal(bad(s=>s.nodes[0].ports[0].contract='unknown')),
  /legacy_contract_version_required/);
 assert.throws(()=>exportGenesisToUniversal(bad(s=>s.nodes[0].ports[1].id='context')),
  /duplicate_source_port/);
 assert.throws(()=>exportGenesisToUniversal(bad(s=>s.edges[1].id=s.edges[0].id)),
  /duplicate_source_edge/);
 assert.throws(()=>exportGenesisToUniversal({schema:'untrusted',nodes:[],edges:[]}),
  /invalid_genesis_schema/);
});
test('512 regions and 511 arcs project within small CPU/JSON budget',()=>{
 const nodes=Array.from({length:512},(_,i)=>({...region('r'+i),ports:[]}));
 const edges=Array.from({length:511},(_,i)=>({
  id:'link'+i,kind:'synapse',from:'r'+i,to:'r'+(i+1),minLinks:0,maxLinks:100}));
 const {graph}=exportGenesisToUniversal({
  schema:'genesis.pe.graph.v1',nodes,edges});
 assert.equal(graph.nodes.length,512);assert.equal(graph.edges.length,511);
 assert.equal(JSON.stringify(graph).includes('"graphRefRevision":0'),true);
});
