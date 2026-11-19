// Reconnect never restores executable actions from a cached client cursor.
import {obj,tok,ref,issue,fail,step,safe} from './projection-common.mjs';
const flags={authoritative:false,authorized:false,executed:false,ui_updated:false,
 can_execute:false,reconnected:false,principal_authenticated:false};
const validCursor=x=>obj(x)&&tok(x.stream_id)&&safe(x.sequence)&&
 ['graph_revision','policy_revision','identity_revision','ui_revision'].every(k=>tok(x[k]));
const critical=new Set(['permission.changed','capability.revoked','provider.revoked',
 'identity.revoked','session.revoked']);
const legal=new Set([...critical,'publication.committed','ui.mount.changed']);
export function planReconnect(p){
 if(!obj(p)||p.schema!=='forge.projection.reconnect.request.v1'||
  !tok(p.request_id)||!ref(p.client_ref)||!tok(p.principal_ref)||
  !validCursor(p.last)||!validCursor(p.current)||
  p.last.stream_id!==p.current.stream_id||!Array.isArray(p.events)||
  p.events.length>128)
  return fail([issue('BAD_RECONNECT','$',
   'Current and cached external cursors must belong to one stream',
   'obtain-new-host-signed-cursor-and-session')]);
 const issues=[],add=(code,path,why,fix)=>issues.push(issue(code,path,why,fix));
 let mode='replay_candidate';
 const reset=(code,path,why,fix)=>{mode='full_resnapshot_required';add(code,path,why,fix);};
 if(p.last.policy_revision!==p.current.policy_revision||
    p.last.identity_revision!==p.current.identity_revision)
  reset('SECURITY_EPOCH_CHANGED','current',
   'Policy or identity epoch changed while client was disconnected',
   'invalidate-client-actions-and-refetch-entitlements');
 if(p.current.sequence<p.last.sequence)
  reset('CURSOR_REWIND','current.sequence','Stream cursor moved backwards',
   'discard-cached-cursor-and-fetch-authoritative-stream-head');
 const delta=p.current.sequence-p.last.sequence;
 if(delta>128||delta!==p.events.length)
  reset('REPLAY_GAP','events','Missing or excessive event history',
   'read-full-current-ui-and-capability-snapshots');
 if(delta===0&&p.last.ui_revision!==p.current.ui_revision)
  reset('UI_REVISION_DRIFT','current.ui_revision',
   'UI revision changed without a matching replay event',
   'fetch-authoritative-principal-ui-snapshot');
 let previous=p.last.graph_revision,seq=p.last.sequence;
 const seen=new Set();
 for(const [i,e] of p.events.entries()){
  const path=`events[${i}]`;
  if(!obj(e)||!tok(e.id)||!legal.has(e.kind)||!safe(e.sequence)||
   !tok(e.receipt_ref)||!tok(e.base_revision)||!tok(e.graph_revision)||
   !tok(e.policy_revision)||!tok(e.identity_revision)||seen.has(e.id)||
   e.sequence!==seq+1||e.base_revision!==previous||
   e.policy_revision!==p.current.policy_revision||
   e.identity_revision!==p.current.identity_revision){
   reset('INVALID_REPLAY_EVENT',path,'Missing, duplicate or divergent replay evidence',
    'replay-from-host-log-or-full-resnapshot');continue;}
  seen.add(e.id);seq=e.sequence;previous=e.graph_revision;
  if(critical.has(e.kind))reset('SECURITY_INVALIDATION',path,
   'A security-sensitive revocation or entitlement change occurred',
   'revoke-local-actions-and-refetch-principal-snapshot');
 }
 if(mode!=='full_resnapshot_required'&&previous!==p.current.graph_revision)
  reset('REVISION_MISMATCH','current.graph_revision',
   'Replay does not reach current authoritative graph revision',
   'refetch-authoritative-graph-and-ui-snapshot');
 if(mode!=='full_resnapshot_required'&&delta===0)mode='reauthorize_and_readback';
 return {ok:true,schema:'forge.projection.reconnect.plan.v1',request_id:p.request_id,
  client_ref:p.client_ref,principal_ref:p.principal_ref,mode,
  invalidate_cached_actions:true,issues,expected_cursor:{...p.last},
  proposed_cursor:{...p.current},events_examined:p.events.length,
  steps:[step('invalidate-stale-ui-actions','ui.projection.invalidate',
   {client_ref:p.client_ref}),
   step('authenticate-and-reauthorize','identity.session.verify',
   {identity_revision:p.current.identity_revision,policy_revision:p.current.policy_revision}),
   step(mode==='full_resnapshot_required'?'fetch-full-projection':'verify-replay',
    mode==='full_resnapshot_required'?'ui.projection.snapshot.read':'events.replay.verify',
    {stream_id:p.current.stream_id,expected_sequence:p.current.sequence}),
   step('verify-current-mounts','ui.projection.readback',
    {expected_ui_revision:p.current.ui_revision}),
   step('commit-cursor-if-confirmed','events.cursor.commit',
    {expected_sequence:p.last.sequence,next_sequence:p.current.sequence})],...flags};
}
