// Cross-node dependency/Raw UI staging preview. No authoritative writes.
import {safe,sortRefs,claimedReachable,obj} from './distribution-common.mjs';
export function finishPlacement(p,{c,jobs,assignment,blocks,block,uiRefs}){
 for(const id of jobs.keys())if(!assignment.has(id))block('MISSING_PLACEMENT',
  `placements[${id}]`,'No explicit provider assignment for function',
  `Function ${id} cannot be dispatched`,['discover-and-explicitly-assign-primary']);
 const dependencyLinks=[],dependencySeen=new Set();
 for(const e of c.graph_intent.edges.filter(x=>x.kind==='depends_on')){
  const caller=assignment.get(e.from), providerJob=[...jobs.values()].find(w=>`capability:${w.action}`===e.to);
  const target=providerJob?assignment.get(providerJob.function_ref):null;
  if(!caller)continue;
  if(!providerJob){
   block('UNRESOLVED_EXTERNAL_DEPENDENCY',`graph_edge:${e.from}->${e.to}`,
    'Dependency is not provided by this composite snapshot',
    `Function ${e.from} is not ready`,['resolve-external-capability-before-publication']);continue;
  }
  if(!target)continue;
  if(caller.node_ref!==target.node_ref){
   const key=`${e.from}\u0000${providerJob.function_ref}`;
   if(!dependencySeen.has(key)){
    dependencySeen.add(key);
    dependencyLinks.push({consumer_function_ref:e.from,provider_function_ref:providerJob.function_ref,
     from_node_ref:caller.node_ref,to_node_ref:target.node_ref,
     contract:e.to.slice('capability:'.length),
     requires_host_authenticated_transport:true,requires_mutual_policy_check:true,
     route_verified:false});
   }
  }
 }
 if(!p.coordinator)block('MISSING_TRANSACTION_COORDINATOR','coordinator',
  'No external transaction authority was supplied',
  'Multi-node visibility cannot be coordinated atomically',
  ['discover-single-authorized-transaction-coordinator']);
 else if(!claimedReachable(p.coordinator))block('COORDINATOR_UNAVAILABLE','coordinator',
  'External coordinator claim is not uniquely authorized/reachable primary',
  'No cross-node publication',
  ['refresh-pinned-coordinator-identity','recheck-current-policy']);
 const placements=sortRefs([...assignment.keys()]).map(id=>{
  const x=assignment.get(id);
  return {function_ref:id,request_id:jobs.get(id).request_id,
   target:{node_ref:x.node_ref,provider_ref:x.provider_ref,action_id:x.action_id,
    contract_version:x.contract_version},trusted:false,authorized:false,
   can_invoke:false,write_target:'explicit-candidate-only'};
 });
 const stagedUi=sortRefs(new Set(c.ui_drafts.filter(obj).map(x=>x.id).filter(id=>uiRefs.has(id))));
 const steps=[
  safe('host.preflight','capability.resolve','check_identity_policy_revision',
   placements.map(x=>x.target),'actual-host-fresh-signed-authenticated-discovery'),
  safe('dependency.preflight','graph.snapshot.read','resolve_cross_node_dependency_contracts',
   dependencyLinks,'mutual-authenticated-transport-and-capability-policy'),
  safe('execution.stage','capability.invoke','execute_individual_atomic_requests',
   placements,'one-exact-target-per-request-and-independent-acceptance'),
  safe('publication.stage','publication.transaction.stage','stage_revision_bound_changes',
   placements.map(x=>x.target),'external-fenced-coordinator-and-cas'),
  safe('ui.stage','ui.contribution.stage','stage_raw_ui_contributions',
   stagedUi,'no-unverified-executable-ui'),
  safe('publication.commit','publication.transaction.commit','external_coordinated_commit',
   p.coordinator?{node_ref:p.coordinator.node_ref,provider_ref:p.coordinator.provider_ref,
    action_id:p.coordinator.action_id}:null,
   'single-authoritative-external-transaction-and-confirmed-readback'),
  safe('visibility.readback','ui.contribution.read','confirm_capability_ui_visibility',
   stagedUi,'same_committed_revision_and_policy')
 ];
 return {ok:true,schema:'forge.distribution.plan.v1',request_id:p.request_id,
  base_graph_revision:p.graph_revision,policy_revision:p.policy_revision,
  discovery_revision:p.discovery_revision,
  complete:blocks.length===0,blockers:blocks,placements,dependency_links:dependencyLinks,
  ui_stage_refs:stagedUi,coordinator_candidate:p.coordinator?{
   node_ref:p.coordinator.node_ref,provider_ref:p.coordinator.provider_ref,
   action_id:p.coordinator.action_id,verified:false}:null,
  steps,transaction_model:'externally-owned-fenced-commit-with-readback',
  invariants:['one-distinct-atomic-work-request-per-function',
   'no-implicit-cross-node-write-failover','authenticate-every-target-and-revision-at-runtime',
   'never-expose-unverified-controls','no-distributed-atomicity-claim-without-external-coordinator'],
  ready_for_host_checks:blocks.length===0,executed:false,authorized:false,
  provider_bound:false,authoritative:false,ui_visible:false,can_execute:false,
  validation_level:'advisory-untrusted-external-snapshot'};
}
