export const functionNode=(ref,req,depends_on=[],mount_refs=[])=>({ref,
 request_ref:req,state:'published',verified:true,depends_on,
 capability_refs:[ref+'.cap'],mount_refs});
export const capability=ref=>({ref:ref+'.cap',function_ref:ref,
 state:'published',verified:true,handler_ref:ref+'.handler'});
export const snapshot={schema:'forge.integrity.snapshot.v1',snapshot_ref:'demo.snapshot.11',
 graph_revision:'graph-11',capability_revision:'cap-11',policy_revision:'policy-11',
 ui_revision:'ui-11',functions:[
  functionNode('demo.lib','request-lib'),
  functionNode('demo.build','request-build',['demo.lib'],['demo.build.mount'])],
 capabilities:[capability('demo.lib'),capability('demo.build')],
 mounts:[{ref:'demo.build.mount',function_ref:'demo.build',
  capability_ref:'demo.build.cap',state:'active',invokable:true}],
 reverse_index:[{function_ref:'demo.lib',dependents:['demo.build']},
  {function_ref:'demo.build',dependents:[]}]};
export const auditRequest={schema:'forge.integrity.audit.request.v1',
 request_id:'request-integrity-11',snapshot};
export const clone=()=>structuredClone(auditRequest);
