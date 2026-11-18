// Inspector fixtures only: NOT live MAS topology, grants or UI state.
export async function makeReactiveSamples(api,fn){
 const request={schema:'forge.reactive.request.v1',request_id:'demo-reactive-0001',
  stream_id:'demo-events',cursor:{stream_id:'demo-events',sequence:0,
   graph_revision:'demo-graph-1',ui_revision:'demo-ui-1',policy_revision:'demo-policy-1'},
  events:[{schema:'forge.reactive.event.v1',id:'demo-evt-1',sequence:1,
   kind:'publication.committed',function_ref:fn.id,base_revision:'demo-graph-1',
   graph_revision:'demo-graph-2',capability_revision:'demo-cap-2',
   policy_revision:'demo-policy-1',transaction_ref:'demo-tx',receipt_ref:'demo-receipt',
   action_id:fn.capability.action,ui_mount_refs:['demo.inspect_button']} ]};
 let plan;
 try{plan=await api.call('forge.reactive.plan',request);}catch{plan=null;}
 const assess={schema:'forge.reactive.assess.request.v1',request_id:request.request_id,
  plan:plan??{},commit:{status:'unknown'},cursor_ack:{},ui_readbacks:[]};
 return {'forge.reactive.plan':request,'forge.reactive.assess':assess};
}
