// Host-supplied catalogs are *claims*, never proof of authorized UI access.
import {obj,tok,ref,issue,fail,step,unique} from './projection-common.mjs';
const necessary=(x)=>obj(x)&&['graph_revision','policy_revision','capability_revision',
 'ui_revision','identity_revision','snapshot_ref'].every(k=>tok(x[k]));
const flags={authoritative:false,authorized:false,executed:false,ui_updated:false,
 can_execute:false,projection_applied:false,principal_authenticated:false};
export function planProjection(p){
 const s=p?.snapshot;
 if(!obj(p)||p.schema!=='forge.projection.request.v1'||!tok(p.request_id)||
  !ref(p.client_ref)||!tok(p.principal_ref)||!necessary(s)||
  s.schema!=='forge.projection.snapshot.v1'||s.client_ref!==p.client_ref||
  s.principal_ref!==p.principal_ref||!Array.isArray(s.grants)||s.grants.length>256||
  !Array.isArray(s.revoked)||s.revoked.length>256||!s.revoked.every(ref)||
  !unique(s.revoked)||!Array.isArray(s.contributions)||
  s.contributions.length>128)
  return fail([issue('BAD_PROJECTION_SNAPSHOT','$',
   'Incomplete externally supplied policy and UI snapshot',
   'fetch-current-principal-scoped-ui-snapshot')]);
 const problems=[],grantMap=new Map(),mounts=new Set(),visible=[];
 const suppressed={denied:0,revoked:0,unverified:0};
 const add=(code,path,why,fix)=>problems.push(issue(code,path,why,fix));
 for(const [i,g] of s.grants.entries()){
  if(!obj(g)||!ref(g.capability_ref)||!['allow','deny'].includes(g.decision)||
   g.policy_revision!==s.policy_revision||grantMap.has(g.capability_ref)){
   add('BAD_GRANT',`snapshot.grants[${i}]`,
    'Invalid, duplicate or revision-inconsistent entitlement',
    'resnapshot-current-host-entitlements');continue;}
  grantMap.set(g.capability_ref,g.decision);
 }
 const revoked=new Set(s.revoked);
 for(const [i,c] of s.contributions.entries()){
  const path=`snapshot.contributions[${i}]`;
  if(!obj(c)||!ref(c.mount_ref)||!ref(c.function_ref)||!ref(c.action_id)||
   !Array.isArray(c.requires)||!c.requires.length||c.requires.length>32||
   !c.requires.every(ref)||!unique(c.requires)||mounts.has(c.mount_ref)||
   !['active','invalidated','disabled'].includes(c.status)||
   typeof c.verified!=='boolean'||typeof c.published!=='boolean'){
   add('BAD_CONTRIBUTION',path,'Malformed, duplicate or ambiguous UI mount',
    'repair-external-ui-mount-contract');continue;}
  mounts.add(c.mount_ref);
  if(c.requires.some(x=>revoked.has(x))){suppressed.revoked++;continue;}
  if(!c.published||!c.verified||c.status!=='active'){
   suppressed.unverified++;continue;}
  if(c.requires.some(x=>grantMap.get(x)!=='allow')){suppressed.denied++;continue;}
  visible.push({mount_ref:c.mount_ref,function_ref:c.function_ref,
   action_id:c.action_id,requires:[...c.requires],desired_state:'candidate_visible',
   invokable:false,published_by_forge:false});
 }
 if(problems.length)return fail(problems);
 return {ok:true,schema:'forge.projection.plan.v1',request_id:p.request_id,
  client_ref:p.client_ref,principal_ref:p.principal_ref,
  expected_revisions:{graph:s.graph_revision,policy:s.policy_revision,
   capability:s.capability_revision,ui:s.ui_revision,identity:s.identity_revision},
  snapshot_ref:s.snapshot_ref,contributions:visible,suppressed_counts:suppressed,
  steps:[step('revalidate-principal','identity.session.verify',
    {client_ref:p.client_ref,identity_revision:s.identity_revision}),
   step('reauthorize-exact-actions','capability.resolve',
    {policy_revision:s.policy_revision,graph_revision:s.graph_revision}),
   step('stage-personal-projection','ui.projection.stage',
    {snapshot_ref:s.snapshot_ref,expected_ui_revision:s.ui_revision}),
   step('cas-commit-and-readback','ui.projection.readback',
    {expected_policy_revision:s.policy_revision,expected_identity_revision:s.identity_revision})],
  requires_host_reauthorization:true,requires_external_readback:true,...flags};
}
