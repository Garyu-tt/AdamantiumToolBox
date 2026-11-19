import {strict as assert} from 'node:assert';
import {assessRevocation} from '../apps/forge/access.mjs';
import {revisions} from './forge-r09-lease.case.mjs';
const id='rev-operation-1', caps=['demo.read','demo.write'],
 actions=['demo.inspect','demo.export'],mounts=['demo.inspect_button','demo.export_button'];
const scope={principal_ref:'principal-demo',client_ref:'demo.client'};
export const revokeRequest={schema:'forge.access.revocation.request.v1',
 request_id:'rev-request-1',operation_ref:id,principal_ref:'principal-demo',
 client_ref:'demo.client',event_ref:'event-revocation-1',...revisions,
 targets:{capability_refs:caps,action_ids:actions,mount_refs:mounts},evidence:{
  scope:{...scope,state:'complete',operation_ref:id,graph_revision:revisions.graph_revision,
   capability_refs:caps,action_ids:actions,mount_refs:mounts},
  policy:{...scope,state:'committed',operation_ref:id,policy_revision:revisions.policy_revision,
   identity_revision:revisions.identity_revision,revoked_capabilities:caps},
  runtime:{...scope,state:'enforced',operation_ref:id,policy_revision:revisions.policy_revision,
   disabled_actions:actions},
  ui:{...scope,state:'committed',operation_ref:id,ui_revision:revisions.ui_revision,
   hidden_mounts:mounts},
  readback:{...scope,state:'confirmed',operation_ref:id,ui_revision:revisions.ui_revision,
   absent_mounts:mounts},
  cursor:{...scope,state:'committed',operation_ref:id,policy_revision:revisions.policy_revision,
   event_ref:'event-revocation-1'}
 }};
export function testRevoke(){
 const r=assessRevocation(revokeRequest);
 assert.equal(r.ok,true);assert.equal(r.evidence_consistent,true,JSON.stringify(r.issues));
 assert.equal(r.issues.length,0);
 for(const k of ['authoritative','authorized','executed','ui_updated','can_execute','access_revoked'])
  assert.equal(r[k],false,k);
 const copy=()=>structuredClone(revokeRequest);
 let p=copy();p.evidence.runtime.state='unknown';
 assert.equal(assessRevocation(p).evidence_consistent,false,'UI hidden but runtime active');
 p=copy();p.evidence.readback.absent_mounts=['demo.inspect_button'];
 assert.equal(assessRevocation(p).evidence_consistent,false,'incomplete UI readback');
 p=copy();p.evidence.scope.action_ids=['demo.inspect'];
 assert.equal(assessRevocation(p).evidence_consistent,false,'reverse dependency incomplete');
 p=copy();p.evidence.policy.identity_revision='old-identity';
 assert.equal(assessRevocation(p).evidence_consistent,false,'stale identity');
 p=copy();p.evidence.cursor.event_ref='wrong-event';
 assert.equal(assessRevocation(p).evidence_consistent,false,'cursor mismatch');
 p=copy();p.evidence.policy.policy_revision='old-policy';
 assert.equal(assessRevocation(p).evidence_consistent,false,'stale policy');
 p=copy();p.evidence.runtime.disabled_actions.push('demo.inspect');
 assert.equal(assessRevocation(p).evidence_consistent,false,'duplicate acknowledgement');
 p=copy();p.targets.action_ids=[];p.targets.capability_refs=[];p.targets.mount_refs=[];
 assert.equal(assessRevocation(p).ok,false,'empty requested revocation');
 p=copy();delete p.evidence.ui;
 assert.equal(assessRevocation(p).evidence_consistent,false,'missing UI ack');
 p=copy();p.evidence.scope.principal_ref='wrong-principal';
 assert.equal(assessRevocation(p).evidence_consistent,false,'cross-principal receipt');
 p=copy();p.evidence.scope.operation_ref='other-operation';
 assert.equal(assessRevocation(p).evidence_consistent,false,'wrong operation');
}
