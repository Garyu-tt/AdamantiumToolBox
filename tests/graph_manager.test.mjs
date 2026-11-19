import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {validateManifest,validateGraph} from '../core/contract.mjs';
import {projectGraph,findCycles,filterGraph,impacted} from '../apps/graph_manager/model.js';
const root=new URL('../apps/graph_manager/',import.meta.url);
const m=JSON.parse(await readFile(new URL('manifest.json',root)));
assert(validateManifest(m));
const spec={app:m.id,version:1,nodes:[
 {id:'graph_manager.view',type:'view',title:m.name,icon:m.icon,requires:['graph_manager.read']}],edges:[]};
assert(validateGraph(spec,m));
const core={nodes:[{id:'worker.view',type:'view',title:'Worker'},
 {id:'db.task',type:'resource',entity:{schema:'mas-graph-entity-1',kind:'task',title:'Backup',
  status:'blocked',reason:'disk full',diagnostic:'pack-1',responsible:'agent-A',source:'issue-42'}},
 {id:'api.action',type:'action',title:'API'},{id:'invalid-id!',type:'action'}],edges:[
 {from:'api.action',to:'db.task',type:'depends'},
 {from:'db.task',to:'worker.view',type:'depends'},
 {from:'api.action',to:'removed.action',type:'depends'}]};
const graph=projectGraph(core);
assert.equal(graph.nodes.filter(n=>n.kind==='plugin').length,3);
assert.equal(graph.nodes.find(n=>n.id==='db.task').status,'blocked');
assert.equal(graph.nodes.find(n=>n.id==='api.action').status,'unknown');
assert.equal(graph.missing.length,1);
assert.deepEqual(impacted(graph,'db.task'),['api.action']);
assert.equal(filterGraph(graph,{blockers:true}).nodes[0].id,'db.task');
assert.equal(filterGraph(graph,{layer:'plugin'}).nodes.length,3);
assert.equal(filterGraph(graph,{query:'disk full'}).nodes.length,1);
assert(graph.edges.some(e=>e.from==='mas:db'&&e.to==='db.task'));
assert.equal(graph.cycles.length,0);
const bad=projectGraph({nodes:core.nodes,edges:[
 {from:'db.task',to:'api.action',type:'depends'},
 {from:'api.action',to:'db.task',type:'depends'}]});
assert.equal(bad.cycles.length,1);
assert.deepEqual(impacted(bad,'db.task'),['api.action']);
assert.deepEqual(projectGraph({nodes:[],edges:[]}).nodes,[]);
assert.equal(findCycles([],[]).length,0);
const malformed=projectGraph({nodes:[{id:'bad.view',title:{evil:true},entity:{schema:'mas-graph-entity-1',kind:'task',title:{evil:true},status:'magic'}}]});
assert.equal(malformed.nodes.find(n=>n.id==='bad.view').title,'bad.view');
assert.equal(malformed.nodes.find(n=>n.id==='bad.view').status,'unknown');
console.log('GRAPH_MANAGER_MODEL_OK provenance blocked dependencies cycles filters empty');