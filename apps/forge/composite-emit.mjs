// Emit stateless graph, UI and per-function work intents after validation.
import {createHash} from 'node:crypto';
import {limits,issue,reject,sorted} from './composite-common.mjs';
export function emitComposite(p,{functions,actions,groups,contains,views}){
 const errors=[];
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
