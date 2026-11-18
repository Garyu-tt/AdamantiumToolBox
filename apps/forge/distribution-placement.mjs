// Structural preflight of explicit targets for each atomic work request.
import {obj,token,ref,MAX,issue,reject,targets,claimedReachable} from './distribution-common.mjs';
import {finishPlacement} from './distribution-stage.mjs';
export function planDistribution(p){
 const errors=[];
 const add=(code,path,reason,fix,observed)=>errors.push(issue(code,path,reason,
  'Distributed invocation and UI activation cannot be authorized',fix,observed));
 if(!obj(p)||p.schema!=='forge.distribution.request.v1')
  return reject([issue('BAD_SCHEMA','schema','Expected forge.distribution.request.v1',
   'No safe distributed plan',['use-distribution-v1'])]);
 if(!token(p.request_id)||p.request_id.length<8)add('BAD_REQUEST','request_id',
  'Stable request ID (8..128 chars) required',['supply-stable-request-id']);
 for(const k of ['graph_revision','policy_revision','discovery_revision'])
  if(!token(p[k]))add('MISSING_REVISION',k,`Missing external ${k}`,[`refresh-${k.replace('_','-')}`]);
 const c=p.composition;
 if(!obj(c)||c.schema!=='forge.composite.plan.v1'||c.ok!==true||
   !obj(c.graph_intent)||!Array.isArray(c.graph_intent.nodes)||
   !Array.isArray(c.graph_intent.edges)||!Array.isArray(c.work_items)||
   !Array.isArray(c.ui_drafts)||c.work_items.length<1||
   c.work_items.length>MAX.functions||c.graph_intent.edges.length>MAX.edges||
   c.ui_drafts.length>MAX.ui)
  add('BAD_COMPOSITION','composition','Bounded R05 composition plan required',
   ['regenerate-composition-from-current-graph']);
 if(!Array.isArray(p.placements)||p.placements.length>MAX.participants)
  add('BAD_PLACEMENTS','placements','Bounded explicit placements required',['supply-explicit-primary-targets']);
 if(p.coordinator!==undefined&&p.coordinator!==null&&!targets(p.coordinator))
  add('BAD_COORDINATOR','coordinator','Coordinator claim must contain explicit versioned action and node',
   ['refresh-coordinator-discovery']);
 if(errors.length)return reject(errors);
 const jobs=new Map(), graphFns=new Map(), capNodes=new Set(), uiRefs=new Set(), allGraphIds=new Set();
 for(const [i,n] of c.graph_intent.nodes.entries()){
  if(!obj(n)||!token(n.id)){
   add('BAD_GRAPH_NODE',`composition.graph_intent.nodes[${i}]`,'Missing graph node ID',['refresh-composition']);continue;}
  if(allGraphIds.has(n.id))add('DUPLICATE_GRAPH_NODE',`composition.graph_intent.nodes[${i}]`,
   'Graph node is duplicated',['repair-graph-snapshot']);
  allGraphIds.add(n.id);
  if(n.kind==='function'){
   if(graphFns.has(n.id))add('DUPLICATE_FUNCTION',`composition.graph_intent.nodes[${i}]`,
    'Function graph node is duplicated',['repair-graph-snapshot']);
   graphFns.set(n.id,n);
  }
  if(n.kind==='capability')capNodes.add(n.id);
  if(n.kind==='ui_contribution')uiRefs.add(n.id);
 }
 for(const [i,w] of c.work_items.entries()){
  if(!obj(w)||w.schema!=='forge.atomic.work.intent.v1'||!ref(w.function_ref)||
    !ref(w.action)||!token(w.request_id)||jobs.has(w.function_ref)||
    !graphFns.has(w.function_ref)||!capNodes.has(`capability:${w.action}`))
   add('BAD_WORK_ITEM',`composition.work_items[${i}]`,
    'Atomic work must identify one unique graph function and its capability',
    ['recreate-atomic-work-items']);
  else jobs.set(w.function_ref,w);
 }
 if(jobs.size!==graphFns.size)add('FUNCTION_SET_MISMATCH','composition',
  'Every function node requires exactly one atomic work request',['rebuild-composition']);
 for(const [i,e] of c.graph_intent.edges.entries()){
  if(!obj(e)||!token(e.from)||!token(e.to)||!allGraphIds.has(e.from)||
     !allGraphIds.has(e.to)||!['contains','provides','depends_on','displayed_as'].includes(e.kind))
   add('BAD_GRAPH_EDGE',`composition.graph_intent.edges[${i}]`,
    'Unsupported or malformed graph relation',['rebuild-composition']);
 }
 if(errors.length)return reject(errors);
 const assignment=new Map(),blocks=[];
 const block=(code,path,reason,impact,remedies,observed)=>blocks.push(issue(code,path,reason,impact,remedies,observed));
 for(const [i,a] of p.placements.entries()){
  const path=`placements[${i}]`;
  if(!obj(a)||!ref(a.function_ref)||!targets(a)||!jobs.has(a.function_ref)){
   add('BAD_PLACEMENT',path,'Placement needs a known function and exact target',
    ['refresh-graph-and-provider-snapshot']);continue;}
  if(assignment.has(a.function_ref)){
   add('AMBIGUOUS_PLACEMENT',path,`More than one write target for ${a.function_ref}`,
    ['select-one-explicit-write-primary']);continue;}
  const job=jobs.get(a.function_ref);
  if(job.action!==a.action_id||graphFns.get(a.function_ref).version?.split('.')[0]!==
    a.contract_version.split('.')[0]){
   add('INCOMPATIBLE_PLACEMENT',path,'Function action or major version does not match',
    ['resolve-compatible-provider']);continue;}
  assignment.set(a.function_ref,a);
  if(!claimedReachable(a))block('UNVERIFIED_OR_UNREACHABLE_TARGET',path,
   'Target claims do not satisfy primary/reachability/pin/policy preflight',
   `Function ${a.function_ref} must remain unavailable`,
   ['refresh-authenticated-host-discovery','select-authorized-primary'],
   {status:a.status,primary:a.primary,identity_pinned:a.identity_pinned,policy_allowed:a.policy_allowed});
 }
 if(errors.length)return reject(errors);
 return finishPlacement(p,{c,jobs,assignment,blocks,block,uiRefs});
}
