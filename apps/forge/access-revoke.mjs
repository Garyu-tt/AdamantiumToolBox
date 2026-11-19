// Untrusted receipt consistency only: even a coherent receipt NEVER authorizes an invocation.
import {obj,tok,ref,refs,exact,revisions,issue,fail,step,flags} from './access-common.mjs';
const wanted={scope:'complete',policy:'committed',runtime:'enforced',
 ui:'committed',readback:'confirmed',cursor:'committed'};
const fields={scope:'graph_revision',policy:'policy_revision',
 runtime:'policy_revision',ui:'ui_revision',readback:'ui_revision',
 cursor:'policy_revision'};
const targetFields={scope:['capability_refs','action_ids','mount_refs'],
 policy:['capability_refs'],runtime:['action_ids'],
 ui:['mount_refs'],readback:['mount_refs']};
export function assessRevocation(p){
 const t=p?.targets,e=p?.evidence;
 if(!obj(p)||p.schema!=='forge.access.revocation.request.v1'||
  !tok(p.request_id)||!tok(p.operation_ref)||!ref(p.client_ref)||
  !tok(p.principal_ref)||!revisions(p)||!obj(t)||!obj(e)||
  !refs(t.capability_refs)||!refs(t.action_ids)||!refs(t.mount_refs,128)||
  (!t.capability_refs.length&&!t.action_ids.length&&!t.mount_refs.length)||
  !tok(p.event_ref))return fail([issue('INVALID_REVOCATION_REQUEST','$',
   'A scoped operation with explicit targets, revisions and receipts is required',
   'read-current-policy-graph-and-revocation-transaction')]);
 const issues=[];
 for(const [name,status] of Object.entries(wanted)){
  const r=e[name],path=`evidence.${name}`,revision=fields[name];
  if(!obj(r)||r.state!==status||r.operation_ref!==p.operation_ref||
   r.principal_ref!==p.principal_ref||r.client_ref!==p.client_ref||
   r[revision]!==p[revision]){
   issues.push(issue('RECEIPT_UNCONFIRMED',path,
    'External '+name+' receipt absent, incomplete, stale or inconsistent',
    'readback-and-reconcile-external-'+name+'-transaction'));continue;
  }
  for(const key of targetFields[name]||[]){
   const actual= name==='policy'?r.revoked_capabilities:
    name==='runtime'?r.disabled_actions:
    name==='ui'?r.hidden_mounts:
    name==='readback'?r.absent_mounts:r[key];
   if(!exact(actual,t[key]))issues.push(issue('TARGET_COVERAGE_MISMATCH',path+'.'+key,
    'Receipt does not cover the complete requested revocation scope',
    'query-graph-reverse-dependencies-and-repeat-verified-readback'));
  }
  if(name==='cursor'&&r.event_ref!==p.event_ref)
   issues.push(issue('CURSOR_EVENT_MISMATCH',path+'.event_ref',
    'Committed event cursor does not match revocation operation',
    'query-durable-revocation-event-and-cursor'));
 }
 if(obj(e.policy)&&e.policy.identity_revision!==p.identity_revision)
  issues.push(issue('IDENTITY_EPOCH_MISMATCH','evidence.policy.identity_revision',
   'Policy receipt belongs to another principal identity revision',
   'reauthenticate-principal-and-fetch-current-policy'));
 return {ok:true,schema:'forge.access.revocation.assessment.v1',request_id:p.request_id,
  operation_ref:p.operation_ref,evidence_consistent:issues.length===0,
  issues,required_receipts:Object.keys(wanted),
  requires_external_signature_validation:true,requires_current_host_policy_readback:true,
  steps:[step('verify-current-identity-and-policy','identity.session.verify',
   {client_ref:p.client_ref,policy_revision:p.policy_revision}),
   step('verify-runtime-denial','capability.access.readback',
    {operation_ref:p.operation_ref}),
   step('verify-ui-absence-and-reverse-dependencies','ui.projection.readback',
    {operation_ref:p.operation_ref}),
   step('verify-durable-cursor','events.cursor.commit',
    {event_ref:p.event_ref})],...flags};
}
