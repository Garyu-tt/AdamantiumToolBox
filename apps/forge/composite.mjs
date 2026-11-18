// R05: pure recursive composition + reverse impact projections.
// No graph storage, capability invocation, authorization, UI mutation or agents.
import {validateFunction} from './contract.mjs';
import {createHash} from 'node:crypto';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ref=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
const semver=/^\d+\.\d+\.\d+$/;
const limits={functions:256,groups:256,depth:64,edges:8192}; // CPU/input safety, not architectural plugin limits.
const issue=(code,path,reason,actions=['inspect-input'])=>({code,path,reason,
 evidence:{path,check:code},impact:'Cannot create a safe composition or impact plan',
 remedies:actions.map(action=>({action,risk:'manual'}))});
const reject=errors=>({ok:false,errors,executed:false,persisted:false,published:false,
 authoritative:false,provider_bound:false,can_execute:false});
const insert=(map,key,value)=>{if(!map.has(key))map.set(key,value);};
const sorted=arr=>arr.sort((a,b)=>a.localeCompare(b));
const cleanRevision=r=>typeof r==='string'&&r.length>0&&r.length<=128;

export function planComposite(p){
 const errors=[];
 if(!obj(p)||p.schema!=='forge.composite.request.v1')errors.push(issue('BAD_SCHEMA','schema','Expected forge.composite.request.v1'));
 if(typeof p?.request_id!=='string'||p.request_id.length<8||p.request_id.length>128)
  errors.push(issue('BAD_REQUEST_ID','request_id','Stable request ID required (8..128 characters)'));
 if(p?.expected_revision!==undefined&&!cleanRevision(p.expected_revision))
  errors.push(issue('BAD_REVISION','expected_revision','External graph revision must be an opaque nonempty token'));
 if(!Array.isArray(p?.functions)||p.functions.length<1||p.functions.length>limits.functions)
  errors.push(issue('BAD_CATALOG','functions','Nonempty bounded catalog of atomic functions is required'));
 if(!obj(p?.root))errors.push(issue('BAD_ROOT','root','A recursive root group is required'));
 if(errors.length)return reject(errors);
 const functions=new Map(),actions=new Map();
 for(const [i,fn] of p.functions.entries()){
  const check=validateFunction(fn);
  if(!check.ok){for(const e of check.errors)errors.push(issue('INVALID_FUNCTION',`functions[${i}].${e.path}`,e.reason));continue;}
  if(functions.has(fn.id))errors.push(issue('DUPLICATE_FUNCTION',`functions[${i}].id`,fn.id,['remove-duplicate-function']));
  else functions.set(fn.id,fn);
  const action=fn.capability.action;
  if(actions.has(action))errors.push(issue('AMBIGUOUS_CAPABILITY',`functions[${i}].capability.action`,
    `Several local functions declare ${action}`,['choose-explicit-provider-or-separate-namespace']));
  else actions.set(action,fn.id);
 }
 if(errors.length)return reject(errors);
 const groups=new Map(),mounted=new Map(),contains=[],views=[];
 // Nested containers have distinct identities; function refs are reusable across groups.
 function walk(group,depth,path){
  if(depth>limits.depth){errors.push(issue('DEPTH_LIMIT',path,'Composition exceeds safe traversal depth',['split-composition-request']));return;}
  if(!obj(group)||group.kind!=='group'||!ref.test(group.id)||!semver.test(group.version||'')){
   errors.push(issue('INVALID_GROUP',path,'Group needs namespaced id and semantic version'));return;}
  if(groups.has(group.id)||functions.has(group.id)){
   errors.push(issue('DUPLICATE_GROUP',path,`Duplicated or colliding group ${group.id}`));return;}
  if(typeof group.label!=='string'||!group.label.trim()||!Array.isArray(group.children)||group.children.length===0){
   errors.push(issue('INVALID_GROUP_UI',path,'Group needs a label and nonempty children'));return;}
  if(groups.size>=limits.groups){errors.push(issue('GROUP_LIMIT',path,'Composition exceeds bounded planning size'));return;}
  groups.set(group.id,group);
  views.push({id:`ui:${group.id}`,kind:'ui_contribution',role:'group',
   target_ref:group.id,label:group.label,availability:'unverified',invokable:false});
  for(const [i,child] of group.children.entries()){
   const at=`${path}.children[${i}]`;
   if(child?.kind==='function'){
    if(typeof child.ref!=='string'||!functions.has(child.ref)){
     errors.push(issue('UNKNOWN_FUNCTION',at,'Child reference must resolve to an atomic function',['add-function-to-catalog']));continue;}
    const key=`${group.id}\u0000${child.ref}`;
    if(mounted.has(key)){errors.push(issue('DUPLICATE_MOUNT',at,'Same function mounted twice within one group'));continue;}
    mounted.set(key,true);
    contains.push({from:group.id,to:child.ref,kind:'contains'});
   }else if(child?.kind==='group'){
    if(!ref.test(child.id||'')){
     errors.push(issue('INVALID_CHILD',at,'Nested group has no valid reference'));continue;}
    contains.push({from:group.id,to:child.id,kind:'contains'});
    walk(child,depth+1,at);
   }else errors.push(issue('INVALID_CHILD',at,'Child must be a group or a function reference'));
  }
 }
 walk(p.root,0,'root');
 for(const id of functions.keys())if(![...mounted.keys()].some(k=>k.endsWith(`\u0000${id}`)))
  errors.push(issue('UNMOUNTED_FUNCTION','functions',`${id} is absent from the composition tree`,['mount-function-reference']));
 if(errors.length)return reject(errors);
 const graphNodes=[...groups.values()].map(g=>({id:g.id,kind:'composite',version:g.version,executable:false}));
 const graphEdges=[...contains],depEdges=[],external=[];
 for(const fn of functions.values()){
  graphNodes.push({id:fn.id,kind:'function',version:fn.version,executable:true,request_atomic:true});
  const capId=`capability:${fn.capability.action}`;
  graphNodes.push({id:capId,kind:'capability',action:fn.capability.action,version:fn.version,availability:'unverified'});
  graphEdges.push({from:fn.id,to:capId,kind:'provides'});
  const uiId=`ui:${fn.id}`;
  if(fn.ui?.expose!==false){
   graphNodes.push({id:uiId,kind:'ui_contribution',availability:'unverified',invokable:false});
   graphEdges.push({from:capId,to:uiId,kind:'displayed_as'});
   views.push({id:uiId,kind:'ui_contribution',role:fn.ui?.role||'action',target_ref:fn.id,
    action:fn.capability.action,label:fn.ui?.label||fn.id.split('.').at(-1),
    requires_permission:fn.capability.permission||null,
    input_schema:fn.capability.input_schema,availability:'unverified',invokable:false});
  }
  for(const dep of fn.dependencies||[]){
   const depId=`capability:${dep.capability}`;
   graphEdges.push({from:fn.id,to:depId,kind:'depends_on'});
   if(actions.has(dep.capability))depEdges.push([fn.id,actions.get(dep.capability)]);
   else external.push({consumer_ref:fn.id,capability:dep.capability,unresolved:true});
  }
 }
 for(const g of groups.values())graphNodes.push({id:`ui:${g.id}`,kind:'ui_contribution',availability:'unverified',invokable:false});
 for(const g of groups.values())graphEdges.push({from:g.id,to:`ui:${g.id}`,kind:'displayed_as'});
 // External dependency nodes are explicitly unresolved, never claimed as installed.
 for(const cap of new Set(external.map(x=>x.capability)))
  if(!graphNodes.some(n=>n.id===`capability:${cap}`))
   graphNodes.push({id:`capability:${cap}`,kind:'capability',availability:'external-unresolved'});
 if(graphEdges.length>limits.edges)return reject([issue('EDGE_LIMIT','root','Planning limits exceeded')]);
 // DFS over function dependency edges only: a composite group does not execute and cannot introduce runtime cycles.
 const deps=new Map([...functions.keys()].map(x=>[x,[]]));
 for(const [consumer,provider] of depEdges)deps.get(consumer).push(provider);
 const visiting=new Set(),visited=new Set(),stack=[],order=[];
 const visit=id=>{
  if(visiting.has(id)){
   const start=stack.indexOf(id);
   errors.push(issue('DEPENDENCY_CYCLE',id,`Dependency cycle: ${[...stack.slice(start),id].join(' -> ')}`,
    ['split-cycle-or-introduce-explicit-asynchronous-boundary']));return;
  }
  if(visited.has(id))return;
  visiting.add(id);stack.push(id);
  for(const d of sorted(deps.get(id)))visit(d);
  stack.pop();visiting.delete(id);visited.add(id);order.push(id);
 };
 for(const id of sorted([...functions.keys()]))visit(id);
 if(errors.length)return reject(errors);
 const reverse={};
 for(const edge of graphEdges){
  if(!reverse[edge.to])reverse[edge.to]=[];
  reverse[edge.to].push({ref:edge.from,kind:edge.kind});
 }
 for(const x of Object.values(reverse))x.sort((a,b)=>a.ref.localeCompare(b.ref)||a.kind.localeCompare(b.kind));
 return {ok:true,schema:'forge.composite.plan.v1',request_id:p.request_id,
  expected_revision:p.expected_revision??null,root_ref:p.root.id,
  graph_intent:{owner:'external-graph-manager',nodes:graphNodes,edges:graphEdges,
   reverse_index_preview:reverse,authoritative:false},
  work_items:order.map(id=>({schema:'forge.atomic.work.intent.v1',function_ref:id,
   request_id:`forge-${createHash('sha256').update(p.request_id+'\u0000'+id).digest('hex').slice(0,40)}`,
   parent_request_id:p.request_id,action:functions.get(id).capability.action,
   acceptance:functions.get(id).request.acceptance,
   executable:false,provider_bound:false})),
  ui_drafts:views,external_dependencies:external,
  topology:{function_count:functions.size,group_count:groups.size,view_count:views.length,
   reused_function_mounts:contains.filter(x=>x.to&&functions.has(x.to)).length-functions.size,
   order:'dependency-first',cyclic:false},
  executed:false,persisted:false,published:false,ui_visible:false,
  provider_bound:false,authoritative:false,can_execute:false,
  validation_level:'structural-only'};
}

export function planCompositeImpact(p){
 const errors=[];
 if(!obj(p)||p.schema!=='forge.composite.impact.request.v1')errors.push(issue('BAD_SCHEMA','schema','Expected forge.composite.impact.request.v1'));
 if(!cleanRevision(p?.observed_revision))errors.push(issue('BAD_REVISION','observed_revision','External graph revision required'));
 if(!['dependency.changed','contract.changed','provider.revoked','permission.changed','function.invalidated','function.updated'].includes(p?.trigger))
  errors.push(issue('BAD_TRIGGER','trigger','Supported event trigger required'));
 const g=p?.graph_intent;
 if(!obj(g)||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.length>1536||g.edges.length>limits.edges)
  errors.push(issue('BAD_GRAPH','graph_intent','Bounded external graph snapshot needed'));
 if(!Array.isArray(p?.changed_refs)||p.changed_refs.length===0||p.changed_refs.length>256)
  errors.push(issue('BAD_CHANGED_REFS','changed_refs','At least one bounded changed reference required'));
 if(errors.length)return reject(errors);
 const ids=new Set(),kinds=new Map();
 for(const n of g.nodes){
  if(!obj(n)||typeof n.id!=='string'||!n.id||ids.has(n.id)){
   errors.push(issue('DUPLICATE_NODE','graph_intent.nodes','Each node needs unique nonempty id'));continue;}
  ids.add(n.id);kinds.set(n.id,n.kind);
 }
 for(const [i,e] of g.edges.entries())if(!obj(e)||!ids.has(e.from)||!ids.has(e.to)||
  !['contains','provides','depends_on','displayed_as'].includes(e.kind))
  errors.push(issue('INVALID_EDGE',`graph_intent.edges[${i}]`,'Edges must reference known nodes and supported relations'));
 for(const ref of p.changed_refs)if(!ids.has(ref))errors.push(issue('UNKNOWN_CHANGE','changed_refs',
  `Changed node ${String(ref)} is not present in the provided graph`,['refresh-external-snapshot']));
 if(errors.length)return reject(errors);
 // For change in dependency B, traverse reverse dependents A. For changing a child,
 // propagate to parent group UI; for changing a capability, refresh its contribution.
 const propagates=new Map([...ids].map(id=>[id,[]]));
 for(const e of g.edges){
  if(e.kind==='depends_on'||e.kind==='contains')propagates.get(e.to).push({to:e.from,relation:e.kind});
  if(e.kind==='provides'||e.kind==='displayed_as')propagates.get(e.from).push({to:e.to,relation:e.kind});
  // A capability invalidation must revisit its provider's function and hence its dependent functions.
  if(e.kind==='provides')propagates.get(e.to).push({to:e.from,relation:'provider_invalidated'});
 }
 const impacted=new Map(),queue=[];
 for(const id of new Set(p.changed_refs)){
  impacted.set(id,{ref:id,kind:kinds.get(id),via:null,relation:'changed'});queue.push(id);
 }
 for(let cursor=0;cursor<queue.length;cursor++){
  const id=queue[cursor];
  for(const link of propagates.get(id)){
   if(impacted.has(link.to))continue;
   impacted.set(link.to,{ref:link.to,kind:kinds.get(link.to),via:id,relation:link.relation});queue.push(link.to);
  }
 }
 const all=[...impacted.values()];
 const needsReverification=all.filter(n=>n.kind==='function').map(n=>n.ref);
 const ui=all.filter(n=>n.kind==='ui_contribution').map(n=>n.ref);
 const groups=all.filter(n=>n.kind==='composite').map(n=>n.ref);
 const steps=[
  {port:'graph.reverse_dependencies.read',operation:'compare_reverse_index',gate:'external_authoritative_revision'},
  {port:'ui.contribution.revoke',operation:'hide_impacted_unverified_controls',targets:ui,gate:'authorized_external_ui_owner'},
  {port:'tasks.work.reconsider',operation:'recheck_atomic_functions',targets:needsReverification,gate:'new_request_per_function'},
  {port:'ui.contribution.stage',operation:'recompute_composite_groups',targets:groups,gate:'verified_children_only'},
  {port:'verification.acceptance.evaluate',operation:'reverify',targets:needsReverification,gate:'independent_verifier'},
  {port:'publication.transaction.commit',operation:'commit_after_proofs',gate:'external_cas_and_readback'}
 ];
 return {ok:true,schema:'forge.composite.impact.plan.v1',observed_revision:p.observed_revision,
  trigger:p.trigger,changed_refs:[...new Set(p.changed_refs)],impacted:all,
  revisit_function_refs:needsReverification,ui_revoke_intents:ui,
  composite_refresh_refs:groups,steps,
  snapshot_authoritative:false,verified:false,executed:false,persisted:false,
  provider_bound:false,ui_revoked:false,ui_visible:false,authoritative:false,can_execute:false};
}
