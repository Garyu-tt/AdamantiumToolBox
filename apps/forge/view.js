import {makeReactiveSamples} from './view-r07-samples.js';
import {makeProjectionSamples} from './view-r08-samples.js';
// Pure contract inspector; no backend state.
export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 add('h2','Mechanicus Forge · Adapter API');
 add('p','Только контракты и планы. Граф, память, выполнение и публикация принадлежат внешним провайдерам.');
 const status=add('p',''),choices=add('select'),area=add('textarea');
 area.rows=13;area.style.width='100%';
 const functionNode={schema:'forge.function.v1',id:'mechanicus.example.inspect',version:'0.1.0',
  request:{atomic:true,goal:'Inspect one function',acceptance:['Typed result must be verified']},
  capability:{action:'example.inspect',input_schema:{type:'object'},output_schema:{type:'object'}},
  dependencies:[],ui:{expose:true,role:'action',label:'Inspect'}};
 const samples={
  'forge.validate':{function:functionNode},
  'forge.prepare':{function:functionNode,request_id:'request-inspect-0001',arguments:{}},
  'forge.compose':{function:functionNode,request_id:'request-inspect-0001'},
  'forge.publication.plan':{function:functionNode,request_id:'request-inspect-0001'},
  'forge.reconcile.prepare':{function_ref:functionNode.id,observed_revision:'rev-1',trigger:'dependency.changed'},
  'forge.providers.negotiate':{flow:'publication',input:{function:functionNode,request_id:'request-inspect-0001'},
   snapshot:{schema:'forge.provider.snapshot.v1',revision:'revision-from-host',policy_revision:'policy-from-host',
    source:'host-runtime',observed_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+60000).toISOString(),capabilities:[]}},
  'forge.events.project':{schema:'forge.events.batch.v1',stream_id:'host-events',
   cursor:{stream_id:'host-events',sequence:0,revision:'host-rev-0'},events:[{schema:'forge.event.v1',
    id:'event-1',sequence:1,type:'dependency.changed',function_ref:functionNode.id,observed_revision:'host-rev-1'}]},
  'forge.integration.prepare':{schema:'forge.integration.request.v1',flow:'publication',
   input:{function:functionNode,request_id:'request-inspect-0001',expected_revision:'graph-rev-1'},
   snapshot:{schema:'forge.provider.snapshot.v1',revision:'host-rev-1',policy_revision:'policy-rev-1',
    source:'host-runtime',observed_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+60000).toISOString(),capabilities:[]}},
  'forge.visibility.assess':{schema:'forge.visibility.assessment.request.v1',mode:'publish',
   request_id:'request-inspect-0001',function_ref:functionNode.id,
   expected_revision:'graph-rev-1',capability_action:functionNode.capability.action,
   evidence:{host:{},commit:{},capability:{},ui:{}}},
  'forge.composite.plan':{schema:'forge.composite.request.v1',request_id:'forge-req-composite-1',
   functions:[functionNode],root:{kind:'group',id:'mechanicus.example.group',version:'1.0.0',
    label:'Example functions',children:[{kind:'function',ref:functionNode.id}]}},
  'forge.composite.impact':{schema:'forge.composite.impact.request.v1',observed_revision:'host-rev-1',
   trigger:'function.updated',changed_refs:[functionNode.id],graph_intent:{nodes:[
    {id:functionNode.id,kind:'function'}],edges:[]}},
  'forge.incident.validate':{incident_id:'incident-1',node_ref:functionNode.id,
   cause:{code:'NO_PROVIDER',explanation:'Compatible provider was not discovered'},
   evidence:[{ref:'diagnostic:trace-1'}],impact:{direct:[functionNode.id]},
   remedies:[{action:'rerun authorized provider discovery',risk:'safe'}]}
 };
 const submit=add('button','Inspect'),out=add('pre','');
 out.style.whiteSpace='pre-wrap';out.style.overflowWrap='anywhere';
 try{
  const info=await api.call('forge.describe');
  try{
   const composite=await api.call('forge.composite.plan',samples['forge.composite.plan']);
   if(composite?.ok){
    const demoPlacement={function_ref:functionNode.id,node_ref:'demo.node',
     provider_ref:'demo.provider',action_id:functionNode.capability.action,
     contract_version:functionNode.version,primary:true,status:'reachable',
     can_invoke:true,identity_pinned:true,policy_allowed:true};
    samples['forge.distribution.plan']={schema:'forge.distribution.request.v1',
     request_id:'demo-distribution-request-0001',graph_revision:'demo-graph-revision',
     policy_revision:'demo-policy-revision',discovery_revision:'demo-discovery-revision',
     composition:composite,placements:[demoPlacement],coordinator:{...demoPlacement,
      node_ref:'demo.coordinator',provider_ref:'demo.transaction',
      action_id:'publication.transaction.commit',contract_version:'1.0.0'}};
   }
  }catch{/* Optional peer unavailable. */}
  Object.assign(samples,await makeReactiveSamples(api,functionNode),makeProjectionSamples(functionNode));
  samples['forge.distribution.recover']={schema:'forge.distribution.recovery.request.v1',
   operation_id:'demo-operation-0001',request_id:'demo-distribution-request-0001',
   graph_revision:'demo-graph-revision',policy_revision:'demo-policy-revision',mode:'publish',
   participants:[{node_ref:'demo.node',function_refs:[functionNode.id],status:'unknown'}],
   coordinator:{status:'unknown'},ui_readback:{state:'unknown'}};
  const actions=info.adapter_actions.filter(id=>id!=='forge.describe'&&samples[id]);
  for(const action of actions){const option=add('option',action,choices);option.value=action;}
  const reset=()=>{area.value=JSON.stringify(samples[choices.value],null,2);out.textContent='';};
  choices.onchange=reset;reset();
  status.textContent=`Adapter ${info.schema} · ${info.provider_ports.length} proposed optional provider contracts`;
 }catch(e){status.textContent='Contract discovery unavailable: '+e.message;}
 submit.onclick=async()=>{
  try{const data=JSON.parse(area.value);
   out.textContent=JSON.stringify(await api.call(choices.value,data),null,2);
  }catch(e){out.textContent='Contract inspection failed: '+e.message;}
 };
}
