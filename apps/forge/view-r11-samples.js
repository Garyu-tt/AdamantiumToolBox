export function makeIntegritySamples(){
 const fn=(ref,req,dep=[],mount=[])=>({ref,request_ref:req,state:'published',
  verified:true,depends_on:dep,capability_refs:[ref+'.cap'],mount_refs:mount});
 const snapshot={schema:'forge.integrity.snapshot.v1',snapshot_ref:'demo.snapshot.11',
  graph_revision:'graph-11',capability_revision:'cap-11',policy_revision:'policy-11',
  ui_revision:'ui-11',functions:[fn('demo.lib','request-lib'),
   fn('demo.build','request-build',['demo.lib'],['demo.build.mount'])],
  capabilities:['demo.lib','demo.build'].map(ref=>({ref:ref+'.cap',
   function_ref:ref,state:'published',verified:true,handler_ref:ref+'.handler'})),
  mounts:[{ref:'demo.build.mount',function_ref:'demo.build',capability_ref:'demo.build.cap',
   state:'active',invokable:true}],reverse_index:[
   {function_ref:'demo.lib',dependents:['demo.build']},
   {function_ref:'demo.build',dependents:[]}]};
 return {'forge.integrity.audit':{schema:'forge.integrity.audit.request.v1',
  request_id:'request-integrity-demo',snapshot},
 'forge.integrity.plan':null};
}
