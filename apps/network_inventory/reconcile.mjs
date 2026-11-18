import {isIP} from 'node:net';
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(v);
export function reconcileBindings(input,snapshot){
 if(!obj(input)||!id(input.targetNode)||!obj(input.topology)||
  !Array.isArray(input.topology.nodes)||!Array.isArray(input.topology.services)||
  input.topology.nodes.length>250||input.topology.services.length>1000)throw Error('invalid_input');
 if(!obj(snapshot)||snapshot.schema!=='network-inventory-snapshot-1')throw Error('invalid_snapshot');
 const nodes=new Map(),services=new Set(),issues=[],checks=[];
 for(const n of input.topology.nodes){
  if(!obj(n)||!id(n.id)||nodes.has(n.id)||!Array.isArray(n.addresses)||
   n.addresses.length>32||!n.addresses.every(x=>typeof x==='string'&&isIP(x)!==0))
   throw Error('invalid_node');
  nodes.set(n.id,n);
 }
 if(!nodes.has(input.targetNode))throw Error('target_not_in_topology');
 const actual=new Set(snapshot.interfaces.flatMap(x=>x.addresses.map(a=>a.address)));
 const owner=new Set(nodes.get(input.targetNode).addresses);
 for(const s of input.topology.services){
  if(!obj(s)||!id(s.id)||services.has(s.id)||!nodes.has(s.node)||
   !Array.isArray(s.addresses)||s.addresses.length>32||
   !s.addresses.every(x=>typeof x==='string'&&isIP(x)!==0))
   throw Error('invalid_service');
  services.add(s.id);
  if(s.node!==input.targetNode)continue;
  if(!s.addresses.length)issues.push({code:'unbound_service',service:s.id});
  for(const address of s.addresses){
   const observed=actual.has(address),declared=owner.has(address);
   checks.push({service:s.id,address,observedLocally:observed,declaredOnNode:declared});
   if(!observed)issues.push({code:'service_address_not_observed',service:s.id,address});
   if(!declared)issues.push({code:'service_address_not_declared',service:s.id,address});
  }
 }
 for(const address of owner)if(!actual.has(address))
  issues.push({code:'node_address_not_observed',node:input.targetNode,address});
 if(snapshot.routeEvidence.v4!=='procfs_partial'||snapshot.routeEvidence.v6!=='procfs_partial')
  issues.push({code:'routing_visibility_incomplete'});
 return {schema:'network-inventory-reconciliation-1',targetNode:input.targetNode,
  observedAt:snapshot.observedAt,inventoryRevision:snapshot.revision,checks,issues,
  localObservationOnly:true,nodeIdentityVerified:false,routingVerified:false,
  natVerified:false,managementReachabilityVerified:false,canApply:false};
}
