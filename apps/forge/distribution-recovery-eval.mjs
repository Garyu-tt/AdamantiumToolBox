// Interpret partial/ambiguous results; only external-only repair intents.
import {token,safe,sortRefs} from './distribution-common.mjs';
export function finishRecovery(p,{participants,issues,block,seenFns}){
 const s=p.coordinator;
 if(['prepared','committed','aborted'].includes(s.status)&&!token(s.receipt_ref))
  block('MISSING_COORDINATOR_RECEIPT','coordinator','Transaction status lacks receipt',
   'Coordinator claim cannot be trusted',['readback-coordinator-journal']);
 if(s.status==='committed'&&(s.policy_revision!==p.policy_revision||
   !token(s.committed_revision)||s.operation_id!==p.operation_id))
  block('COORDINATOR_POLICY_MISMATCH','coordinator.policy_revision',
   'Coordinator operation, revision or policy disagrees with expected context','Cannot assume transaction committed under current policy',
   ['reauthorize-and-readback-coordinator']);
 const ui=p.ui_readback;
 if(ui.state!=='unknown'&&(!token(ui.receipt_ref)||ui.policy_revision!==p.policy_revision))
  block('UI_READBACK_UNBOUND','ui_readback',
   'UI observation lacks receipt or matching policy',
   'Interface may be out of sync',['reauthorize-ui-readback']);
 const committedRevisions=[...new Set(p.participants.filter(x=>x.status==='committed').map(x=>x.committed_revision))];
 if(committedRevisions.length>1)block('DIVERGENT_COMMIT_REVISIONS','participants',
  'Different node receipts reference different graph revisions',
  'Cross-node graph state cannot be treated as a single publication',
  ['readback-transaction-journal','fence-and-reconcile-divergent-nodes']);
 const onlyCommittedRevision=committedRevisions.length===1?committedRevisions[0]:null;
 if(s.status==='committed'&&onlyCommittedRevision&&s.committed_revision!==onlyCommittedRevision)
  block('COORDINATOR_REVISION_MISMATCH','coordinator.committed_revision',
   'Coordinator committed revision differs from participant receipts',
   'External global commit remains unproven',['refresh-coordinator-transaction-readback']);
 if(ui.state!=='unknown'&&s.status==='committed'&&
    (ui.revision!==s.committed_revision||ui.operation_id!==p.operation_id))
  block('UI_REVISION_MISMATCH','ui_readback',
   'UI revision or operation does not match external commit',
   'UI could expose stale or unrelated functionality',
   ['reauthorize-revision-bound-ui-readback']);
 const count=status=>participants.filter(x=>x.status===status).length;
 const anyUnknown=count('unknown')>0||s.status==='unknown'||ui.state==='unknown';
 const committed=count('committed'),allCommitted=committed===participants.length;
 const anyFailed=count('failed')>0;
 const partial=committed>0&&!allCommitted;
 const desiredUi=p.mode==='publish'?'visible':'hidden';
 let candidate='externally-unconfirmed';
 if(anyUnknown)candidate='ambiguous-outcome';
 else if(partial||anyFailed||s.status==='aborted'&&committed>0)candidate='partial-or-orphan-commit';
 else if(allCommitted&&s.status==='committed'&&ui.state===desiredUi)
  candidate='consistent-on-supplied-receipts';
 else if(committed===0&&count('not_started')===participants.length&&s.status==='absent')
  candidate='not-started';
 else candidate='staged-or-visibility-unresolved';
 if(anyUnknown)block('AMBIGUOUS_WRITE_RESULT','participants/coordinator/ui_readback',
  'At least one write or readback result is unknown',
  'Blind retry risks duplicate or divergent state',
  ['query-idempotency-ledger','readback-every-participant-before-resume']);
 if(partial||anyFailed||s.status==='aborted'&&committed>0)
  block('PARTIAL_DISTRIBUTED_COMMIT','participants',
   'Not all participants report matching committed state',
   'Graph, capability and UI may disagree',
   ['fence-affected-writes','readback-transaction-and-participants',
    'prepare-explicit-compensating-transaction-after-approval']);
 if(s.status!=='committed'&&ui.state==='visible'&&p.mode==='publish')
  block('UI_EXPOSED_WITHOUT_COMMIT','ui_readback',
   'Visible UI is reported without completed external publication transaction',
   'Users may see unverified controls',
   ['deny-invocation-at-runtime','authorize-ui-revocation-and-readback']);
 if(allCommitted&&s.status!=='committed')
  block('MISSING_GLOBAL_COMMIT','coordinator',
   'Node-level committed receipts do not establish a global commit',
   'No atomic multi-node publication guarantee',
   ['readback-coordinator-journal']);
 if(ui.state!==desiredUi)
  block('VISIBILITY_NOT_CONFIRMED','ui_readback',
   'UI state does not match desired publish/revoke outcome',
   'External UI still requires reconciliation',
   ['readback-ui-revision','reconcile-ui-externally']);
 if(issues.length&&candidate==='consistent-on-supplied-receipts')
  candidate='receipt-incomplete';
 const steps=[
  safe('host.fence','capability.invoke','deny_unsafe_retries_until_readback',
   participants.map(x=>x.node_ref),'external-host-policy'),
  safe('transaction.readback','publication.transaction.status','readback_coordinator_by_operation_id',
   {operation_id:p.operation_id},'authenticated-coordinator'),
  safe('participants.readback','capability.status.read','readback_all_participants_by_operation_id',
   participants.map(x=>x.node_ref),'fresh-pinned-host-identity-and-policy'),
  safe('ui.readback','ui.contribution.read','compare_ui_capability_graph_revisions',
   [...seenFns],'same-external-transaction-revision'),
  safe('incident.report','diagnostic.incident.report','report_explained_partial_or_ambiguous_failure',
   issues.map(x=>x.code),'external-diagnostics-owner')
 ];
 return {ok:true,schema:'forge.distribution.recovery.plan.v1',operation_id:p.operation_id,
  request_id:p.request_id,mode:p.mode,graph_revision:p.graph_revision,
  policy_revision:p.policy_revision,candidate_state:candidate,
  affected_function_refs:sortRefs(seenFns),participants,issues,steps,
  safe_to_automatically_retry_writes:false,safe_to_automatically_rollback:false,
  safe_to_expose_ui:false,requires_external_authoritative_readback:true,
  executed:false,authorized:false,provider_bound:false,authoritative:false,
  ui_visible:false,can_execute:false};
}
