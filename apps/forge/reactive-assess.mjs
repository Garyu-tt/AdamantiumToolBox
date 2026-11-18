// Forge R07: classify UNTRUSTED external UI and cursor readback receipts.
import {obj,tok,ref,problem,reject} from './reactive-common.mjs';
const issue=(code,reason,path,fix)=>problem(code,reason,path,
 'Reactive UI visibility and cursor progress are unconfirmed',fix);
export function assessReactive(p){
 const plan=p?.plan,commit=p?.commit,cursor=p?.cursor_ack,views=p?.ui_readbacks;
 if(!obj(p)||p.schema!=='forge.reactive.assess.request.v1'||
    !obj(plan)||plan.ok!==true||plan.schema!=='forge.reactive.plan.v1'||
    !Array.isArray(plan.changes)||plan.changes.length<1||
    !obj(commit)||!obj(cursor)||!Array.isArray(views))
  return reject([issue('BAD_READBACK','$','Complete external plan and receipts required',
   'request-authoritative-ui-and-cursor-readback')]);
 const errors=[],add=(c,r,path,fix)=>errors.push(issue(c,r,path,fix));
 const expected=plan.expected_cursor,next=plan.proposed_cursor;
 if(!tok(p.request_id)||p.request_id!==plan.request_id||
    !obj(expected)||!obj(next)||!tok(plan.stream_id)||
    !Number.isSafeInteger(expected.sequence)||!Number.isSafeInteger(next.sequence)||
    next.sequence!==expected.sequence+plan.changes.length)
  add('PLAN_MISMATCH','Plan identity or cursor progression is inconsistent','plan',
   'refresh-authoritative-stream-snapshot');
 const txs=[...new Set(plan.changes.map(x=>x.transaction_ref))];
 const eventIds=plan.changes.map(x=>x.event_id);
 if(commit.status!=='committed'||!tok(commit.commit_ref)||!tok(commit.readback_ref)||
    commit.request_id!==plan.request_id||
    commit.expected_ui_revision!==expected?.ui_revision||
    !tok(commit.applied_ui_revision)||
    commit.applied_ui_revision===expected?.ui_revision||
    commit.graph_revision!==next?.graph_revision||
    commit.policy_revision!==next?.policy_revision||
    !Array.isArray(commit.transaction_refs)||
    commit.transaction_refs.length!==txs.length||
    new Set(commit.transaction_refs).size!==txs.length||
    txs.some(t=>!commit.transaction_refs.includes(t))||
    !Array.isArray(commit.event_ids)||commit.event_ids.length!==eventIds.length||
    new Set(commit.event_ids).size!==eventIds.length||
    eventIds.some(id=>!commit.event_ids.includes(id)))
  add('UI_COMMIT_MISMATCH','Batch UI CAS commit not proven by supplied receipt',
   'commit','readback-external-ui-commit-journal');
 if(cursor.status!=='committed'||cursor.stream_id!==plan.stream_id||cursor.sequence!==next?.sequence||
    cursor.graph_revision!==next?.graph_revision||
    cursor.ui_revision!==commit.applied_ui_revision||
    cursor.policy_revision!==next?.policy_revision||
    !tok(cursor.readback_ref)||cursor.commit_ref!==commit.commit_ref)
  add('CURSOR_ACK_MISMATCH','Durable stream cursor receipt does not match UI commit',
   'cursor_ack','readback-external-cursor-and-reconcile');
 const mounts=new Map();
 for(const change of plan.changes){
  for(const mount of change.ui_mount_refs||[]){
   if(mounts.has(mount))add('MOUNT_CONFLICT','One UI mount has multiple owners',
    'plan.changes','repair-external-ui-mount-projection');
   else mounts.set(mount,change);
  }
 }
 const found=new Set();
 for(const [i,ui] of views.entries()){
  const path=`ui_readbacks[${i}]`;
  if(!obj(ui)||!ref(ui.mount_ref)||found.has(ui.mount_ref)||!mounts.has(ui.mount_ref)){
   add('UNKNOWN_OR_DUPLICATE_MOUNT','Unexpected or duplicate readback',path,
    'refresh-external-ui-snapshot');continue;
  }
  found.add(ui.mount_ref);
  const change=mounts.get(ui.mount_ref);
  const expectedState=change.desired_state;
  if(ui.function_ref!==change.function_ref||ui.state!==expectedState||
     ui.ui_revision!==commit.applied_ui_revision||
     ui.graph_revision!==next?.graph_revision||
     ui.policy_revision!==next?.policy_revision||
     !tok(ui.readback_ref)||
     (expectedState!=='hidden'&&(ui.capability_revision!==change.capability_revision||
     ui.action_id!==change.action_id)))
   add('UI_READBACK_MISMATCH','Mount state or revision differs from planned transition',
    path,'force-readback-and-invalidate-stale-ui');
 }
 for(const mount of mounts.keys())if(!found.has(mount))
  add('MISSING_UI_READBACK',`No receipt for ${mount}`,'ui_readbacks',
   'request-authoritative-ui-mount-readback');
 const consistent=errors.length===0;
 return {ok:consistent,schema:'forge.reactive.assessment.v1',
  candidate_state:consistent?'consistent-on-supplied-receipts':'incomplete-or-divergent',
  observed_consistent:consistent,issues:errors,
  required_external_steps:['authenticate-receipts','verify-current-policy-and-node-identity',
   'verify-committed-runtime-state','confirm-external-event-cursor'],
  authoritative:false,authorized:false,executed:false,ui_updated:false,
  cursor_committed:false,can_execute:false};
}
