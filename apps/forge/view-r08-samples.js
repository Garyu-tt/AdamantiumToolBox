// Inspector fixtures: descriptions only, never user identity or current grants.
export function makeProjectionSamples(fn){
 const scope={graph_revision:'demo-graph-9',policy_revision:'demo-policy-3',
  capability_revision:'demo-cap-7',ui_revision:'demo-ui-4',
  identity_revision:'demo-identity-5'};
 const cursor={stream_id:'demo-stream',sequence:4,...scope};
 delete cursor.capability_revision;
 return {
  'forge.projection.plan':{schema:'forge.projection.request.v1',request_id:'demo-project',
   client_ref:'demo.client',principal_ref:'demo-principal',snapshot:{
    schema:'forge.projection.snapshot.v1',client_ref:'demo.client',
    principal_ref:'demo-principal',snapshot_ref:'demo-snapshot',...scope,
    grants:[{capability_ref:'demo.inspect',decision:'allow',policy_revision:scope.policy_revision}],
    revoked:[],contributions:[{mount_ref:'demo.inspect_button',function_ref:fn.id,
     action_id:fn.capability.action,requires:['demo.inspect'],status:'active',
     verified:true,published:true}]}},
  'forge.projection.reconnect':{schema:'forge.projection.reconnect.request.v1',
   request_id:'demo-reconnect',client_ref:'demo.client',principal_ref:'demo-principal',
   last:cursor,current:cursor,events:[]}
 };
}
