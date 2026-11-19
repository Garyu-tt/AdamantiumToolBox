import {strict as assert} from 'node:assert';
import {discoverTaskReader,federate} from '../apps/graph_manager/federation.js';
import {impacted,filterGraph} from '../apps/graph_manager/model.js';
const runtime={nodes:[
 {id:'worker.action',type:'action',title:'Worker'},
 {id:'worker.view',type:'view',title:'Worker'},
 {id:'tasks.view',type:'view',title:'Tasks'},
 {id:'tasks.list',type:'action',title:'List tasks'},
 {id:'tasks.provider',type:'resource',provider:{schema:'mas-task-provider-1'}}
],edges:[{from:'worker.view',to:'worker.action',type:'uses'}]};
assert.equal(discoverTaskReader(runtime),'tasks.list');
assert.equal(discoverTaskReader({nodes:runtime.nodes.filter(x=>x.id!=='tasks.list')}),null);
assert.equal(discoverTaskReader({nodes:runtime.nodes.map(x=>x.id==='tasks.provider'?{
 ...x,provider:{schema:'mas-task-provider-1',listAction:'other.list'}}:x)}),null);
const code={schema:'mas-codegraph-1',nodes:[
 {file:'apps/worker/service.mjs',sha256:'ab'},
 {file:'apps/worker/helpers.mjs',sha256:'cd'},
 {file:'core/kernel.mjs',sha256:'ef'}
],edges:[{from:'apps/worker/service.mjs',to:'apps/worker/helpers.mjs',type:'imports'}]};
const tasks=[{taskId:'11111111-1111-1111-1111-111111111111',title:'Repair worker',status:'needs_review',
 revision:3,requires:['worker.action'],note:'stale claim',lease:{workerId:'agent-1'}}];
const graph=federate(runtime,{code,tasks,taskAction:'tasks.list'});
assert(graph.nodes.find(n=>n.id==='task:'+tasks[0].taskId).status==='blocked');
assert(graph.edges.some(e=>e.from==='task:'+tasks[0].taskId&&e.to==='worker.action'));
assert(graph.edges.some(e=>e.from==='mas:worker'&&e.to==='file:apps/worker/service.mjs'));
assert(graph.edges.some(e=>e.type==='imports'));
assert(impacted(graph,'worker.action').includes('task:'+tasks[0].taskId));
assert(impacted(graph,'file:apps/worker/helpers.mjs').includes('file:apps/worker/service.mjs'));
assert.equal(filterGraph(graph,{layer:'file'}).nodes.length,3);
const extra=federate(runtime,{code:{...code,nodes:Array.from({length:1000},(_,i)=>({file:`apps/worker/f${i}.mjs`}))},
 tasks:Array.from({length:1000},(_,i)=>({...tasks[0],taskId:'id-'+i}))});
assert.equal(extra.totals.files,1000);assert.equal(extra.totals.tasks,1000);
assert(extra.warnings.includes('codegraph_truncated'));assert(extra.warnings.includes('tasks_truncated'));
assert(extra.nodes.length<500);
assert.equal(federate(runtime).totals.files,0);
console.log('GRAPH_MANAGER_FEDERATION_OK task capability CodeGraph bounded projection');
