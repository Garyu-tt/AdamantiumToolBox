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
// A function can appear under several UI groups without creating multiple execution requests.
const changed={schema:'forge.composite.impact.request.v1',observed_revision:'graph-78',
 trigger:'contract.changed',graph_intent:plan.graph_intent,changed_refs:[a.id]};
const impact=planCompositeImpact(changed);
assert.equal(impact.ok,true,JSON.stringify(impact.errors));
assert(impact.revisit_function_refs.includes(a.id));
assert(impact.revisit_function_refs.includes(b.id));
assert(impact.revisit_function_refs.includes(c.id));
assert(impact.composite_refresh_refs.includes('sample.admin'));
assert(impact.composite_refresh_refs.includes('sample.root'));
assert(impact.ui_revoke_intents.includes(`ui:${b.id}`));
assert.equal(impact.ui_revoked,false);assert.equal(impact.authoritative,false);
const capImpact=planCompositeImpact({...changed,trigger:'provider.revoked',changed_refs:['capability:sample.auth']});
assert.equal(capImpact.ok,true);
assert(capImpact.revisit_function_refs.includes(b.id));
assert.equal(planCompositeImpact({...changed,changed_refs:['unknown.missing']}).ok,false);
assert.equal(planCompositeImpact({...changed,observed_revision:''}).ok,false);
assert.equal(planCompositeImpact({...changed,graph_intent:{...plan.graph_intent,
 edges:[...plan.graph_intent.edges,{from:'missing',to:a.id,kind:'contains'}]}}).ok,false);
// HTTP integration and independent start with only the MAS host, no TaskPool/Graph Manager/agents.
const free=()=>new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>done(port));});});
const port=await free(),secret='forge-r05-independent-test-host-secret';
const child=spawn(process.execPath,[resolve(root,'apps/forge/service.mjs')],{env:{...process.env,
 ADA_INTERNAL_KEY:secret,ADA_CAPS:'forge.read,forge.validate',APP_PORT:String(port)},stdio:'ignore'});
const base='http://127.0.0.1:'+port;
const query=(route,body,auth=true)=>fetch(base+route,{method:body?'POST':'GET',
 headers:{...(auth?{'x-internal-key':secret}:{}),'Content-Type':'application/json'},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(2000)});
try{
 let ready=false;
 for(let i=0;i<40;i++){try{if((await query('/health')).ok){ready=true;break;}}catch{}
  await new Promise(done=>setTimeout(done,50));}
 assert(ready,'Forge-alone service must launch');
 const graph=await (await query('/graph')).json();
 assert(graph.nodes.some(x=>x.id==='forge.composite.plan'));
 assert(graph.nodes.some(x=>x.id==='forge.composite.impact'));
 const cp=await (await query('/invoke',{action:'forge.composite.plan',params:request})).json();
 assert.equal(cp.result.ok,true);assert.equal(cp.result.topology.reused_function_mounts,1);
 const ci=await (await query('/invoke',{action:'forge.composite.impact',params:changed})).json();
 assert.equal(ci.result.ok,true);assert.equal(ci.result.ui_revoked,false);
 assert.equal((await query('/invoke',{action:'forge.composite.plan',params:request},false)).status,401);
 const info=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(info.result.schema,'mechanicus.forge.adapter.v5');
 assert.equal(info.result.stores_state,false);assert.equal(info.result.external_effects,false);
 console.log('FORGE_R05_TEST_OK: recursive/shared function composition, cycle rejection, reverse impact, fail-closed HTTP');
}finally{child.kill();}
