// Computes safe-deny UI and renewal candidates from a bounded external snapshot.
import {obj,tok,ref,refs,utc,revisions,issue,fail,step,flags} from './access-common.mjs';
const validGrant=(g,s)=>obj(g)&&ref(g.capability_ref)&&tok(g.lease_ref)&&
 ['allow','deny'].includes(g.decision)&&g.policy_revision===s.policy_revision&&
 g.identity_revision===s.identity_revision&&utc(g.valid_from)!==null&&
 utc(g.valid_until)!==null&&utc(g.valid_until)>utc(g.valid_from);
const validMount=m=>obj(m)&&ref(m.mount_ref)&&ref(m.function_ref)&&ref(m.action_id)&&
 refs(m.requires,32)&&m.requires.length>0&&['active','invalidated','disabled'].includes(m.status)&&
 typeof m.verified==='boolean'&&typeof m.published==='boolean';
export function planLeases(p){
 const s=p?.snapshot;
 if(!obj(p)||p.schema!=='forge.access.lease.request.v1'||!tok(p.request_id)||
  !ref(p.client_ref)||!tok(p.principal_ref)||!obj(s)||
  s.schema!=='forge.access.lease.snapshot.v1'||
  s.client_ref!==p.client_ref||s.principal_ref!==p.principal_ref||
  !revisions(s)||!tok(s.snapshot_ref)||utc(s.observed_at)===null||
  !Array.isArray(s.grants)||s.grants.length>256||
  !Array.isArray(s.mounts)||s.mounts.length>128||
  !Number.isInteger(p.renew_before_seconds)||p.renew_before_seconds<0||
  p.renew_before_seconds>86400)
  return fail([issue('INVALID_LEASE_SNAPSHOT','$',
   'Scoped host time, revision, entitlement and mount snapshot are required',
   'fetch-current-principal-entitlements-and-host-clock')]);
 const issues=[],grants=new Map(),mounts=new Set(),at=utc(s.observed_at);
 for(const [i,g] of s.grants.entries()){
  if(!validGrant(g,s)||grants.has(g.capability_ref))issues.push(issue('BAD_LEASE',
   `snapshot.grants[${i}]`,'Malformed, duplicate or inconsistent lease',
   'refresh-host-lease-and-policy-revision'));
  else grants.set(g.capability_ref,g);
 }
 for(const [i,m] of s.mounts.entries()){
  if(!validMount(m)||mounts.has(m.mount_ref))issues.push(issue('BAD_MOUNT',
   `snapshot.mounts[${i}]`,'Malformed or duplicate scoped UI mount',
   'fetch-authorized-current-ui-mount-snapshot'));
  else mounts.add(m.mount_ref);
 }
 if(issues.length)return fail(issues);
 const revocations=[],retain_candidates=[],renewal=new Map();
 for(const m of s.mounts){
  const reasons=[];
  if(m.status!=='active'||!m.verified||!m.published)reasons.push('NOT_ACTIVE_OR_VERIFIED');
  for(const cap of m.requires){
   const g=grants.get(cap);
   if(!g){reasons.push('MISSING_GRANT');continue;}
   if(g.decision==='deny'){reasons.push('EXPLICIT_DENY');continue;}
   if(at<utc(g.valid_from)){reasons.push('NOT_YET_VALID');continue;}
   if(at>=utc(g.valid_until)){reasons.push('LEASE_EXPIRED');continue;}
   if(utc(g.valid_until)-at<=p.renew_before_seconds*1000)
    renewal.set(cap,{capability_ref:cap,lease_ref:g.lease_ref,expires_at:g.valid_until});
  }
  if(reasons.length)revocations.push({mount_ref:m.mount_ref,function_ref:m.function_ref,
   action_id:m.action_id,reason_codes:[...new Set(reasons)],executable:false});
  else retain_candidates.push({mount_ref:m.mount_ref,function_ref:m.function_ref,
   action_id:m.action_id,invokable:false,authorized:false});
 }
 return {ok:true,schema:'forge.access.lease.plan.v1',request_id:p.request_id,
  client_ref:p.client_ref,principal_ref:p.principal_ref,snapshot_ref:s.snapshot_ref,
  claimed_observed_at:s.observed_at,expected_revisions:{graph:s.graph_revision,
   policy:s.policy_revision,identity:s.identity_revision,ui:s.ui_revision},
  revocation_candidates:revocations,renewal_candidates:[...renewal.values()],
  retain_candidates,requires_authoritative_host_clock:true,
  requires_exact_action_reauthorization:true,
  steps:[step('read-current-authoritative-entitlements','policy.entitlements.read',
   {snapshot_ref:s.snapshot_ref,principal_ref:p.principal_ref}),
   ...(revocations.length?[step('enforce-scoped-action-denial','capability.access.revoke',
    {principal_ref:p.principal_ref,client_ref:p.client_ref,
     affected_actions:[...new Set(revocations.map(x=>x.action_id))],
     policy_revision:s.policy_revision,identity_revision:s.identity_revision}),
    step('invalidate-affected-ui-mounts','ui.projection.invalidate',
    {principal_ref:p.principal_ref,client_ref:p.client_ref,
     mount_refs:revocations.map(x=>x.mount_ref),ui_revision:s.ui_revision})]:[]),
   step('verify-runtime-deny-and-ui-readback','ui.projection.readback',
    {principal_ref:p.principal_ref,identity_revision:s.identity_revision})],...flags};
}
