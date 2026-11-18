// Reverse impact on an untrusted caller-provided graph snapshot.
import {obj,limits,issue,reject,cleanRevision} from './composite-common.mjs';
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
