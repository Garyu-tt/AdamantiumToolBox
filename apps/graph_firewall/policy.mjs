import {parseTopology,requireFlow,topologyGraph} from './model.mjs';
export function inspect(input){
 const model=parseTopology(input),graph=topologyGraph(model);
 return {schema:'graph-firewall-audit-1',...graph,issues:model.issues,
  summary:{nodes:model.nodes.size,services:model.services.size,rules:model.rules.size,
   issues:model.issues.length},effectiveDefault:'deny',enforcement:'none',safeToApply:false};
}
export function simulate(input){
 const model=parseTopology(input?.topology),flow=requireFlow(input?.flow,model);
 const matches=[...model.rules.values()].filter(r=>r.enabled&&r.from===flow.from&&r.to===flow.to);
 const denies=matches.filter(r=>r.effect==='deny'),allows=matches.filter(r=>r.effect==='allow');
 const serviceMatches=flow.protocol===flow.serviceProtocol&&flow.port===flow.servicePort;
 const verdict=serviceMatches&&allows.length&&!denies.length?'allow':'deny';
 return {schema:'graph-firewall-simulation-1',flow:{from:flow.from,to:flow.to,
   protocol:flow.protocol,port:flow.port},verdict,matchedRules:matches.map(r=>r.id),
   reason:!serviceMatches?'service_endpoint_mismatch':denies.length?'explicit_deny_overrides_allow':
    allows.length?'explicit_allow':'default_deny',
   scope:'logical_intent_only',enforced:false};
}
export function plan(input){
 if(!input||!input.current||!input.proposed)throw Error('invalid_plan');
 const old=parseTopology(input.current),next=parseTopology(input.proposed);
 const previous=[...old.rules.values()],updated=[...next.rules.values()];
 const serialize=x=>JSON.stringify([x.from,x.to,x.effect,x.enabled,x.reason]);
 const added=updated.filter(r=>!old.rules.has(r.id)).map(r=>r.id);
 const removed=previous.filter(r=>!next.rules.has(r.id)).map(r=>r.id);
 const modified=updated.filter(r=>old.rules.has(r.id)&&serialize(r)!==serialize(old.rules.get(r.id))).map(r=>r.id);
 const risks=[];
 const management=input.managementFlows||[];
 if(!Array.isArray(management)||management.length>100)throw Error('invalid_management_flows');
 for(const flow of management){
  const before=simulate({topology:input.current,flow});
  const after=simulate({topology:input.proposed,flow});
  if(before.verdict==='allow'&&after.verdict!=='allow')risks.push({code:'management_lockout',flow});
  if(after.verdict!=='allow')risks.push({code:'management_path_not_allowed',flow});
 }
 if(!management.length)risks.push({code:'management_path_unverified'});
 for(const issue of next.issues)risks.push(issue);
 const scopeChange=JSON.stringify(input.current.nodes)!==JSON.stringify(input.proposed.nodes)||
  JSON.stringify(input.current.services)!==JSON.stringify(input.proposed.services);
 if(scopeChange)risks.push({code:'topology_changed_requires_reverification'});
 return {schema:'graph-firewall-plan-1',added,removed,modified,risks,
  preview:inspect(input.proposed),applied:false,safeToApply:false,
  reason:'backend_adapter_identity_proof_approval_and_rollback_required'};
}
