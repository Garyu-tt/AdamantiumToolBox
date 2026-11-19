import {strict as assert} from 'node:assert';
import {generateKeyPairSync,sign} from 'node:crypto';
import {transactionPlan} from '../apps/nftables_preview/transaction.mjs';
import {approvalPayload} from '../apps/rollback_watchdog/receipt.mjs';
import {makeJournalEvent} from '../apps/rollback_watchdog/journal.mjs';
import {diagnoseTransaction} from '../apps/rollback_watchdog/diagnose.mjs';
const topology={nodes:[
 {id:'operator',kind:'client',addresses:['192.0.2.8']},
 {id:'host',kind:'server',addresses:['192.0.2.20']}],
 services:[{id:'admin',node:'host',protocol:'tcp',port:8443,
  addresses:['192.0.2.20']}],
 rules:[{id:'management',from:'operator',to:'admin',effect:'allow',reason:'operator'}]};
const transaction=transactionPlan({targetNode:'host',topology,
 managementFlows:[{from:'operator',to:'admin',protocol:'tcp',port:8443}]});
const baseline=diagnoseTransaction({transaction},{nowSeconds:1800000100});
assert.equal(baseline.summary.blockedStages,8);
assert.equal(baseline.graph.nodes.filter(x=>x.type==='diagnostic').length,8);
assert.equal(baseline.readyToCommit,false);
assert.equal(baseline.applied,false);
assert(baseline.graph.edges.some(e=>e.type==='blocks'));
assert(baseline.graph.nodes.filter(x=>x.type==='diagnostic')
 .every(x=>x.cause&&x.impact&&x.remediation));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const trustedPublicKey=publicKey.export({format:'der',type:'spki'}).toString('base64');
const issuedAt=1800000000,receiptBase={
 schema:'rollback-watchdog-approval-1',leaseId:'lease-1',
 targetNode:'host',planDigest:transaction.revision,baseRevision:'b'.repeat(64),
 issuedAt,expiresAt:issuedAt+300};
const receipt={...receiptBase,signature:sign(null,
 Buffer.from(approvalPayload(receiptBase)),privateKey).toString('base64')};
const approved=diagnoseTransaction({transaction,receipt,
 expectedLeaseId:'lease-1',expectedTargetNode:'host',
 expectedBaseRevision:'b'.repeat(64)},
 {trustedPublicKey,nowSeconds:issuedAt+1});
assert.equal(approved.approval.signatureValid,true);
assert(approved.observations.includes('signature_check_passed_not_authorization'));
assert.equal(approved.readyToCommit,false);
assert.equal(approved.summary.blockedStages,8);
const context={leaseId:'lease-1',planDigest:transaction.revision};
const armed=makeJournalEvent({...context,seq:1,state:'draft'},null,'armed',issuedAt);
const staged=makeJournalEvent({...context,seq:2,state:'armed'},armed.hash,
 'staged',issuedAt+1);
const journal={schema:'rollback-watchdog-journal-1',...context,
 deadlineSeconds:issuedAt+20,events:[armed,staged]};
const expired=diagnoseTransaction({transaction,journal},{nowSeconds:issuedAt+30});
assert(expired.alerts.some(x=>x.code==='rollback_needs_recovery'));
assert(expired.graph.nodes.some(x=>x.id==='blocker:rollback'&&
 x.cause==='rollback_ledger_requires_reconciliation'));
const spoofed=diagnoseTransaction({transaction:{...transaction,applied:true}});
assert.equal(spoofed.readyToCommit,false);
assert.throws(()=>diagnoseTransaction({transaction:{...transaction,applied:true}}),
 /invalid_transaction/);
console.log('GRAPH_WATCHDOG_DIAGNOSTICS_OK eight explained blockers, no trusted apply');
