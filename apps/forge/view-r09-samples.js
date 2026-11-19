// Inspector fixtures only: no live lease, entitlement or revocation evidence.
export function makeAccessSamples(fn){
 const principal_ref='demo-principal',client_ref='demo.client';
 const rev={graph_revision:'demo-graph',policy_revision:'demo-policy',
  identity_revision:'demo-identity',ui_revision:'demo-ui'};
 const scope={principal_ref,client_ref};
 const operation_ref='demo-revocation',event_ref='demo-event';
 const c=['demo.read'],a=[fn.capability.action],m=['demo.inspect_button'];
 const receipt=(state,extra)=>({...scope,operation_ref,state,...extra});
 return {
  'forge.access.lease.plan':{schema:'forge.access.lease.request.v1',
   request_id:'demo-lease-req',...scope,renew_before_seconds:60,snapshot:{
    schema:'forge.access.lease.snapshot.v1',...scope,...rev,
    snapshot_ref:'demo-lease-snapshot',observed_at:'2026-11-19T01:00:00.000Z',
    grants:[{capability_ref:'demo.read',lease_ref:'demo-lease',decision:'allow',
     valid_from:'2026-11-19T00:00:00.000Z',valid_until:'2026-11-19T01:00:20.000Z',
     policy_revision:rev.policy_revision,identity_revision:rev.identity_revision}],
    mounts:[{mount_ref:m[0],function_ref:fn.id,action_id:a[0],
     requires:c,status:'active',verified:true,published:true}]}},
  'forge.access.revocation.assess':{
   schema:'forge.access.revocation.request.v1',request_id:'demo-revoke-req',
   operation_ref,event_ref,...scope,...rev,
   targets:{capability_refs:c,action_ids:a,mount_refs:m},evidence:{
    scope:receipt('complete',{graph_revision:rev.graph_revision,
     capability_refs:c,action_ids:a,mount_refs:m}),
    policy:receipt('committed',{policy_revision:rev.policy_revision,
     identity_revision:rev.identity_revision,revoked_capabilities:c}),
    runtime:receipt('enforced',{policy_revision:rev.policy_revision,disabled_actions:a}),
    ui:receipt('committed',{ui_revision:rev.ui_revision,hidden_mounts:m}),
    readback:receipt('confirmed',{ui_revision:rev.ui_revision,absent_mounts:m}),
    cursor:receipt('committed',{policy_revision:rev.policy_revision,event_ref})}}
 };
}
