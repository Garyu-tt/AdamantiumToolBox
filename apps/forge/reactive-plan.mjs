// Forge R07: one external stream batch -> one unexecuted UI commit recipe.
import {obj,tok,ref,problem,reject,modes,intent} from './reactive-common.mjs';
const bad=(code,path,reason,fix)=>problem(code,reason,path,
 'A UI/capability change cannot be safely projected',fix);
export function planReactive(p){
 if(!obj(p)||p.schema!=='forge.reactive.request.v1'||!tok(p.request_id)||
    !tok(p.stream_id)||!obj(p.cursor)||p.cursor.stream_id!==p.stream_id||
    !Number.isSafeInteger(p.cursor.sequence)||p.cursor.sequence<0||
    !tok(p.cursor.graph_revision)||!tok(p.cursor.ui_revision)||
    !tok(p.cursor.policy_revision)||!Array.isArray(p.events)||
    p.events.length<1||p.events.length>128)
  return reject([bad('BAD_BATCH','$','External cursor and 1..128 events required',
   'refresh-external-snapshot-and-cursor')]);
 const issues=[],changes=[],seenIds=new Set(),seenFunctions=new Set(),seenMounts=new Set();
 let seq=p.cursor.sequence,revision=p.cursor.graph_revision;
 for(const [i,e] of p.events.entries()){
  const path=`events[${i}]`;
  if(!obj(e)||e.schema!=='forge.reactive.event.v1'||!tok(e.id)||
     !Object.hasOwn(modes,e.kind)||!ref(e.function_ref)||
     !Number.isSafeInteger(e.sequence)||!tok(e.base_revision)||
     !tok(e.graph_revision)||!tok(e.capability_revision)||
     !tok(e.policy_revision)||!tok(e.transaction_ref)||
     !tok(e.receipt_ref)||!Array.isArray(e.ui_mount_refs)||
     e.ui_mount_refs.length>64||!e.ui_mount_refs.every(ref)||
     ((modes[e.kind]==='publish'||e.desired_state==='visible')&&!ref(e.action_id))||
     (modes[e.kind]==='refresh'&&!['visible','hidden'].includes(e.desired_state))){
   issues.push(bad('BAD_EVENT',path,'Malformed or incomplete publication event',
    'repair-authoritative-event-envelope'));continue;
  }
  if(seenIds.has(e.id)||seenFunctions.has(e.function_ref)){
   issues.push(bad('DUPLICATE_EVENT_OR_TARGET',path,'Duplicate event or ambiguous target in batch',
    'rescope-batch-at-external-coordinator'));continue;
  }
  seenIds.add(e.id);seenFunctions.add(e.function_ref);
  if(e.sequence!==seq+1){issues.push(bad('EVENT_GAP',path,
   `Expected ${seq+1} but observed ${e.sequence}`,'replay-external-event-gap'));continue;}
  if(e.base_revision!==revision||e.graph_revision===revision){
   issues.push(bad('REVISION_FORK',path,'Graph CAS revision chain diverges',
    'refresh-authoritative-graph-and-replan'));continue;}
  if(e.policy_revision!==p.cursor.policy_revision){
   issues.push(bad('POLICY_CHANGED',path,'Policy revision changed in an untrusted batch',
    're-authorize-and-refresh-policy-snapshot'));continue;}
  if(new Set(e.ui_mount_refs).size!==e.ui_mount_refs.length){
   issues.push(bad('DUPLICATE_MOUNT',path,'A UI mount is repeated',
    'deduplicate-ui-mounts'));continue;}
  if(e.ui_mount_refs.some(m=>seenMounts.has(m))){
   issues.push(bad('MOUNT_CONFLICT',path,'Mount reused across function transitions',
    'rescope-conflicting-ui-contributions'));continue;}
  for(const mount of e.ui_mount_refs)seenMounts.add(mount);
  seq=e.sequence;revision=e.graph_revision;
  changes.push({event_id:e.id,sequence:seq,function_ref:e.function_ref,
   mode:modes[e.kind],desired_state:modes[e.kind]==='refresh'?e.desired_state:
    modes[e.kind]==='publish'?'visible':'hidden',graph_revision:revision,
   capability_revision:e.capability_revision,
   policy_revision:e.policy_revision,transaction_ref:e.transaction_ref,
   receipt_ref:e.receipt_ref,action_id:e.action_id??null,
   ui_mount_refs:[...e.ui_mount_refs]});
 }
 if(issues.length)return reject(issues);
 const cursor={stream_id:p.stream_id,sequence:seq,graph_revision:revision,
  ui_revision:p.cursor.ui_revision,policy_revision:p.cursor.policy_revision};
 const steps=[
  intent('readback','publication.transaction.status','external-publication-coordinator',
   {transaction_refs:changes.map(x=>x.transaction_ref)}),
  intent('reauthorize','capability.resolve','external-capability-host',
   {policy_revision:cursor.policy_revision,graph_revision:cursor.graph_revision}),
  intent('verify-receipts','verification.acceptance.evaluate','external-independent-verifier'),
  intent('stage-ui-diff','ui.contribution.stage','external-ui-provider',
   {expected_ui_revision:p.cursor.ui_revision,changes}),
  intent('commit-ui-cas','ui.contribution.commit','external-ui-provider',
   {expected_ui_revision:p.cursor.ui_revision,expected_graph_revision:revision}),
  intent('readback-ui','ui.contribution.readback','external-ui-provider'),
  intent('commit-cursor-cas','events.cursor.commit','external-stream-owner',
   {expected_sequence:p.cursor.sequence,next_sequence:seq})];
 return {ok:true,schema:'forge.reactive.plan.v1',request_id:p.request_id,
  stream_id:p.stream_id,expected_cursor:{...p.cursor},proposed_cursor:cursor,
  changes,steps,complete_on_supplied_events:true,
  authoritative:false,authorized:false,executed:false,ui_updated:false,
  cursor_committed:false,can_execute:false,requires_host_readback:true};
}
