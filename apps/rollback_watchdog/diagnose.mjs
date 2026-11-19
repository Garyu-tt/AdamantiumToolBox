import {inspectApproval} from './receipt.mjs';
import {inspectJournal} from './journal.mjs';
const stages=[
 ['identity','Trusted node challenge','obtain an attested target key binding'],
 ['inventory','Interface/route evidence','capture signed local namespace inventory'],
 ['wg_nat','VPN and NAT verification','verify independent WireGuard and route ownership'],
 ['kernel','Ruleset readback','verify live kernel digest with an approved provider'],
 ['management','Out-of-band management','probe a separate recovery transport'],
 ['rollback','Persistent watchdog','arm independently monitored and durable rollback'],
 ['approval','Operator approval','pin a single-use lease and authorized plan hash'],
 ['commit','Atomic enforcement','obtain explicit operator consent and kernel readback']
];
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function diagnoseTransaction(input,options={}){
 const plan=input?.transaction;
 if(!plan||plan.schema!=='nftables-transaction-plan-1'||!hash(plan.revision)||
  plan.applied!==false||plan.readyToCommit!==false||
  !Array.isArray(plan.warnings)||plan.warnings.length>100)
  throw Error('invalid_transaction');
 const alerts=[],observations=[];
 const warn=code=>plan.warnings.some(w=>w?.code===code);
 let approval=null,journal=null;
 let kernelMismatch=false,ledgerIncomplete=false;
 if(input.receipt!==undefined){
  approval=inspectApproval(input.receipt,{expectedLeaseId:input.expectedLeaseId,
   expectedTargetNode:input.expectedTargetNode,
   expectedPlanDigest:plan.revision,
   expectedBaseRevision:input.expectedBaseRevision,
   trustedPublicKey:options.trustedPublicKey,nowSeconds:options.nowSeconds});
  if(approval.signatureValid)observations.push('signature_check_passed_not_authorization');
  else alerts.push({code:'approval_precheck_failed',reason:approval.reason});
 }
 if(input.journal!==undefined){
  journal=inspectJournal(input.journal,{nowSeconds:options.nowSeconds});
  if(journal.planDigest!==plan.revision)alerts.push({
   code:'journal_plan_mismatch',reason:'journal references a different transaction'});
  if(!journal.chainConsistent)alerts.push({
   code:'journal_untrusted_or_broken',reason:'journal requires independent review'});
  if(journal.requiresRecovery)alerts.push({
   code:'rollback_needs_recovery',reason:'expiry or unverified rollback requires intervention'});
 }
 if(input.readback!==undefined){
  const x=input.readback;
  if(x?.schema!=='nftables-readback-1'||x.status!=='observed'||!hash(x.revision))
   alerts.push({code:'kernel_readback_unavailable',
    reason:'snapshot missing or invalid; independent kernel probe required'});
  else if(hash(input.expectedBaseRevision)&&x.revision!==input.expectedBaseRevision){
   kernelMismatch=true;alerts.push({code:'kernel_base_revision_mismatch',
    reason:'observed digest differs from planned base ruleset'});
  }else observations.push('kernel_snapshot_observed_but_unattested');
 }
 if(input.ledger!==undefined){
  const x=input.ledger;
  if(x?.schema!=='rollback-ledger-audit-1'||x.status!=='scanned'||
     !Array.isArray(x.entries)||!Array.isArray(x.issues)){
   ledgerIncomplete=true;alerts.push({code:'ledger_inventory_unavailable'});
  }else{
   ledgerIncomplete=x.issues.length>0||x.entries.some(e=>
    e.state==='incomplete_or_untrusted'||e.state==='expired_needs_review');
   if(ledgerIncomplete)alerts.push({code:'ledger_requires_review',
    reason:'local replay store includes incomplete or expired claims'});
   const found=x.entries.some(e=>e.leaseId===input.expectedLeaseId);
   if(found)observations.push('local_lease_seen_not_distributed_attestation');
   else alerts.push({code:'requested_lease_not_found_in_local_audit'});
  }
 }
 const nodes=[],edges=[];
 for(const [i,[name,label,remediation]] of stages.entries()){
  let cause='requires_independent_evidence';
  if(name==='identity')cause='node_identity_not_attested';
  if(name==='approval')cause=approval?.signatureValid?
   'signature_verified_but_replay_and_node_unverified':'signed_approval_not_verified';
  if(name==='kernel'&&kernelMismatch)cause='kernel_revision_mismatch';
  if(name==='management'&&warn('management_flow_not_in_candidate'))
   cause='management_path_not_preserved';
  if(name==='rollback'&&(journal?.requiresRecovery||ledgerIncomplete))
   cause='rollback_ledger_requires_reconciliation';
  if(name==='commit')cause='privileged_executor_not_installed';
  nodes.push({id:'gate:'+name,type:'gate',label,status:'blocked'});
  nodes.push({id:'blocker:'+name,type:'diagnostic',label:cause,
   cause,impact:'blocks_transaction_commit',remediation,
   evidenceStatus:'not_independently_attested'});
  edges.push({from:'blocker:'+name,to:'gate:'+name,type:'blocks'});
  if(i>0)edges.push({from:'gate:'+stages[i-1][0],to:'gate:'+name,
   type:'prerequisite'});
 }
 return {schema:'rollback-watchdog-diagnostic-1',revision:plan.revision,
  summary:{blockedStages:stages.length,alerts:alerts.length,canApply:false},
  graph:{nodes,edges},alerts,observations,approval,journal,
  readOnly:true,readyToCommit:false,applied:false,
  diagnosticOnly:true};
}
