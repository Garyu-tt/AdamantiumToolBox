// Forge R03: pure, advisory provider matchmaking. NEVER a capability authorization or invocation.
import {planPublication,prepareReconciliation} from './pipeline.mjs';
const isObj = x => x!==null&&typeof x==='object'&&!Array.isArray(x);
const ref=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
const token=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const semver=x=>typeof x==='string'&&/^\d+\.\d+\.\d+$/.test(x);
const evidence=(path,observed)=>({path,observed});
const issue=(code,reason,path,observed,impact,remedies)=>({code,reason,evidence:evidence(path,observed),impact,
 remedies:remedies.map(action=>({action,safety:'external-authorization-required'}))});
const fail=issues=>({ok:false,complete:false,executed:false,provider_bound:false,
 authoritative:false,issues});
const allowedWindow=300000; // maximum snapshot lifetime; does not grant authority
const requiredMode=id=>['resolve','discover_impacted'].includes(id)?'read':'write';
const sort=(a,b)=>[a.provider_ref,a.node_ref,a.action_id].join('|').localeCompare([b.provider_ref,b.node_ref,b.action_id].join('|'));
/**
 * @param {object} p flow: publication | reconciliation, input: R02 parameters, snapshot: external host snapshot
 * @param {number} now clock for pure unit tests; service never accepts a caller-supplied clock
 */
export function negotiateProviders(p,now=Date.now()){
 if(!isObj(p)||!['publication','reconciliation'].includes(p.flow))
  return fail([issue('BAD_FLOW','Select publication or reconciliation','flow',p?.flow,
   'Cannot derive provider requirements',['select-supported-flow'])]);
 const plan=p.flow==='publication'?planPublication(p.input):prepareReconciliation(p.input);
 if(!plan.ok)return fail(plan.errors||[issue('BAD_PLAN','Invalid pipeline input','input','invalid',
  'No requirements can be derived',['repair-function-or-revision'])]);
 const s=p.snapshot;
 if(!isObj(s)||s.schema!=='forge.provider.snapshot.v1'||!token(s.revision)||
    !token(s.policy_revision)||!token(s.source)||!Array.isArray(s.capabilities)||
    s.capabilities.length>512||!token(s.observed_at)||!token(s.expires_at))
  return fail([issue('BAD_SNAPSHOT','Host discovery snapshot with revision, policy and bounded capabilities required',
   'snapshot','malformed','No provider candidate can be trusted',['refresh-discovery-from-host'])]);
 const observed=Date.parse(s.observed_at),expires=Date.parse(s.expires_at);
 if(!Number.isFinite(observed)||!Number.isFinite(expires)||!Number.isFinite(now)||
    observed>now+60000||expires<=now||expires<=observed||expires-observed>allowedWindow)
  return fail([issue('STALE_SNAPSHOT','Discovery snapshot is expired, future-dated, or overlong',
   'snapshot.expires_at',s.expires_at,'Capabilities may be revoked',['refresh-discovery-from-host'])]);
 const ports=[...new Map(plan.steps.map(step=>[step.port,step])).values()];
 const selections=[];const issues=[];
 const validOffer=o=>isObj(o)&&token(o.provider_ref)&&token(o.node_ref)&&ref.test(o.action_id||'')&&
  ref.test(o.contract||'')&&semver(o.contract_version)&&['reachable','unreachable','read_only_standby','disabled'].includes(o.status)&&
  Array.isArray(o.access)&&o.access.every(x=>x==='read'||x==='write')&&typeof o.can_invoke==='boolean'&&
  typeof o.identity_pinned==='boolean'&&typeof o.policy_allowed==='boolean'&&
  typeof o.primary==='boolean';
 if(s.capabilities.some(o=>!validOffer(o)))
  return fail([issue('MALFORMED_OFFER','Malformed capability offer','snapshot.capabilities','invalid',
   'Cannot safely negotiate',['repair-discovery-schema'])]);
 for(const step of ports){
  const mode=requiredMode(step.id);
  const offers=s.capabilities.filter(o=>o.contract===step.port);
  const compatible=offers.filter(o=>o.contract_version.split('.')[0]==='1');
  const approved=compatible.filter(o=>o.status==='reachable'&&o.can_invoke&&o.identity_pinned&&o.policy_allowed&&o.access.includes(mode)).sort(sort);
  // A write cannot route by alphabetical ordering or silently fail over.
  const primary=mode==='write'?approved.filter(o=>o.primary):approved;
  const eligible=mode==='write'?(primary.length===1?primary:[]):approved;
  const choice=eligible.length===1?eligible[0]:null;
  const reason=offers.length===0?'NO_PROVIDER':compatible.length===0?'CONTRACT_MISMATCH':
   approved.length===0?'PROVIDER_UNAVAILABLE':mode==='write'?'AMBIGUOUS_WRITE_PRIMARY':'AMBIGUOUS_READ_PROVIDER';
  if(!choice){issues.push(issue(reason,
   reason==='NO_PROVIDER'?'No provider advertises the required contract':
   reason==='CONTRACT_MISMATCH'?'No compatible v1 contract':
   reason==='PROVIDER_UNAVAILABLE'?'No reachable, pinned, permitted candidate':
   reason==='AMBIGUOUS_WRITE_PRIMARY'?'Write requires exactly one approved primary':
   'Multiple read candidates; runtime must choose explicitly',
   `snapshot.capabilities[${step.port}]`,{count:offers.length,compatible:compatible.length,eligible:approved.length},
   `Pipeline step ${step.id} cannot execute`,
   ['refresh-host-discovery','check-pinned-identity-and-permissions',
    mode==='write'?'select-explicit-write-primary':'select-explicit-read-target']));}
  selections.push({step:step.id,contract:step.port,mode,candidates:approved.map(o=>({
    provider_ref:o.provider_ref,node_ref:o.node_ref,action_id:o.action_id,
    contract_version:o.contract_version,primary:o.primary
   })),proposed:choice?{provider_ref:choice.provider_ref,node_ref:choice.node_ref,action_id:choice.action_id}:null,
   authorized:false,invoked:false});
 }
 return {ok:true,schema:'forge.provider.negotiation.v1',flow:p.flow,request_id:p.input?.request_id??null,
  snapshot_revision:s.revision,policy_revision:s.policy_revision,expires_at:s.expires_at,
  complete:issues.length===0,issues,selections,
  preflight:{required:'host-pinned-identity-and-permission-check',
   require_fresh_snapshot:true,compare_revision:s.revision,compare_policy_revision:s.policy_revision,
   revalidate_before_each_write:true,never_automatic_write_failover:true},
  executed:false,provider_bound:false,authoritative:false,can_execute:false};
}
