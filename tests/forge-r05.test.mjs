import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planComposite,planCompositeImpact} from '../apps/forge/composite.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const template=JSON.parse(await readFile(resolve(root,'apps/forge/example.function.json'),'utf8'));
const example=JSON.parse(await readFile(resolve(root,'apps/forge/example.composite.json'),'utf8'));
assert.equal(planComposite(example).ok,true);
const fn=(id,action,dependencies=[],expose=true)=>({
 ...template,id,version:'1.0.0',request:{atomic:true,goal:`Run ${id}`,acceptance:[`Verify ${id}`]},
 capability:{action,input_schema:{type:'object'},output_schema:{type:'object'}},
 dependencies:dependencies.map(capability=>({capability})),
 ui:{expose,role:'action',label:id.split('.').at(-1)}
});
const a=fn('sample.auth','sample.auth'),
 b=fn('sample.list','sample.list',['sample.auth']),
 c=fn('sample.detail','sample.detail',['sample.list','external.audit']);
const rootGroup={kind:'group',id:'sample.root',version:'1.0.0',label:'Root',children:[
 {kind:'group',id:'sample.admin',version:'1.0.0',label:'Admin',children:[
  {kind:'function',ref:a.id},{kind:'function',ref:b.id}]},
 {kind:'group',id:'sample.console',version:'1.0.0',label:'Console',children:[
  {kind:'function',ref:b.id},{kind:'function',ref:c.id}]}
]};
const request={schema:'forge.composite.request.v1',request_id:'composite-request-2026',
 expected_revision:'graph-77',root:rootGroup,functions:[a,b,c]};
const plan=planComposite(request);
assert.equal(plan.ok,true,JSON.stringify(plan.errors));
assert.equal(plan.schema,'forge.composite.plan.v1');
assert.equal(plan.topology.function_count,3);
assert.equal(plan.topology.group_count,3);
assert.equal(plan.topology.reused_function_mounts,1);
assert.equal(plan.work_items.length,3);
assert.deepEqual(plan.work_items.map(x=>x.function_ref),[a.id,b.id,c.id]);
assert(plan.work_items.every(x=>x.executable===false&&x.provider_bound===false));
assert.equal(new Set(plan.work_items.map(x=>x.request_id)).size,3);
assert(plan.work_items.every(x=>x.request_id.length<=128&&x.parent_request_id===request.request_id));
assert.deepEqual(planComposite(request).work_items.map(x=>x.request_id),plan.work_items.map(x=>x.request_id));
assert.equal(plan.graph_intent.edges.filter(x=>x.kind==='displayed_as'&&x.from==='sample.root').length,1);
assert.equal(plan.graph_intent.nodes.filter(x=>x.id===b.id).length,1);
assert.equal(plan.graph_intent.edges.filter(x=>x.kind==='contains'&&x.to===b.id).length,2);
assert(plan.ui_drafts.every(x=>x.invokable===false));
assert.deepEqual(plan.external_dependencies,[{consumer_ref:c.id,capability:'external.audit',unresolved:true}]);
assert(plan.graph_intent.reverse_index_preview['capability:sample.list'].some(x=>x.ref===b.id));
for(const flag of ['executed','persisted','published','ui_visible','provider_bound','authoritative','can_execute'])
 assert.equal(plan[flag],false);
const invalid=p=>{const v=planComposite(p);assert.equal(v.ok,false);assert(v.errors.every(x=>x.reason&&x.evidence&&x.impact&&x.remedies.length));return v;};
assert(invalid({...request,root:{...rootGroup,children:[{kind:'function',ref:'missing.func'}]}}).errors.some(x=>x.code==='UNKNOWN_FUNCTION'));
assert(invalid({...request,root:{...rootGroup,children:[{kind:'function',ref:a.id}]}}).errors.some(x=>x.code==='UNMOUNTED_FUNCTION'));
assert(invalid({...request,functions:[a,a,b,c]}).errors.some(x=>x.code==='DUPLICATE_FUNCTION'));
assert(invalid({...request,functions:[a,b,fn('sample.other','sample.auth'),c]}).errors.some(x=>x.code==='AMBIGUOUS_CAPABILITY'));
assert(invalid({...request,functions:[{...a,dependencies:[{capability:'sample.detail'}]},b,c]}).errors.some(x=>x.code==='DEPENDENCY_CYCLE'));
const duplicatedGroup={...rootGroup,children:[rootGroup.children[0],{...rootGroup.children[0]}]};
assert(invalid({...request,root:duplicatedGroup}).errors.some(x=>x.code==='DUPLICATE_GROUP'));
assert(invalid({...request,request_id:'short'}).errors.some(x=>x.code==='BAD_REQUEST_ID'));
const modifiedGroup={...rootGroup,children:[{kind:'function',ref:a.id},{kind:'function',ref:a.id},
 {kind:'function',ref:b.id},{kind:'function',ref:c.id}]};
assert(invalid({...request,root:modifiedGroup}).errors.some(x=>x.code==='DUPLICATE_MOUNT'));
const deep=(depth)=>{let node={kind:'group',id:'sample.leaf',version:'1.0.0',label:'Leaf',children:[{kind:'function',ref:a.id}]};
 for(let i=0;i<depth;i++)node={kind:'group',id:`sample.g${i}`,version:'1.0.0',label:'Nested',children:[node]};
 return node;};
assert(invalid({...request,root:deep(70)}).errors.some(x=>x.code==='DEPTH_LIMIT'));
import {runImpactR05} from './forge-r05-impact.case.mjs';
await runImpactR05({a,b,c,plan,request});
